package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public Map<String, Object> getDashboardMetrics() {
        List<OrderEntity> orders = orderRepository.findAll();
        Map<String, Object> metrics = new LinkedHashMap<>();

        double totalRevenue = orders.stream().mapToDouble(o -> o.getTotal() == null ? 0.0 : o.getTotal().doubleValue()).sum();
        long totalOrders = orders.size();
        double avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        long totalCustomers = userRepository.count();
        Set<String> buyerIds = orders.stream().map(OrderEntity::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        double conversionRate = totalCustomers > 0
                ? Math.round((double) buyerIds.size() / totalCustomers * 10000.0) / 100.0
                : 0.0;

        metrics.put("totalRevenue", Math.round(totalRevenue * 100.0) / 100.0);
        metrics.put("totalOrders", totalOrders);
        metrics.put("averageOrderValue", Math.round(avgOrderValue * 100.0) / 100.0);
        metrics.put("totalCustomers", totalCustomers);
        metrics.put("totalProducts", productRepository.count());
        metrics.put("conversionRate", conversionRate);

        Map<String, Long> ordersByStatus = orders.stream()
                .collect(Collectors.groupingBy(o -> o.getStatus() != null ? o.getStatus().name() : "unknown", Collectors.counting()));
        metrics.put("ordersByStatus", ordersByStatus);

        return metrics;
    }

    public Map<String, Object> getSalesAnalytics(int days, String grain) {
        String g = normalizeGrain(grain);
        List<OrderEntity> orders = orderRepository.findAll();

        LocalDate sinceDate = LocalDate.now(ZONE).minusDays(Math.max(1, days));
        Instant since = sinceDate.atStartOfDay(ZONE).toInstant();

        List<OrderEntity> recentOrders = orders.stream()
                .filter(o -> o.getCreatedAt() != null && !o.getCreatedAt().isBefore(since))
                .collect(Collectors.toList());

        TreeMap<String, Double> dailySales = new TreeMap<>();
        TreeMap<String, Long> dailyOrders = new TreeMap<>();

        for (OrderEntity order : recentOrders) {
            LocalDate d = order.getCreatedAt().atZone(ZONE).toLocalDate();
            String key = d.toString();
            dailySales.merge(key, order.getTotal() != null ? order.getTotal().doubleValue() : 0.0, Double::sum);
            dailyOrders.merge(key, 1L, Long::sum);
        }

        TreeMap<String, Double> bucketRevenue = new TreeMap<>();
        TreeMap<String, Long> bucketOrderCount = new TreeMap<>();
        NavigableSet<String> dayKeys = new TreeSet<>();
        dayKeys.addAll(dailySales.keySet());
        dayKeys.addAll(dailyOrders.keySet());
        for (String dayKey : dayKeys) {
            String bk = toSalesBucketKey(dayKey, g);
            Double rev = dailySales.get(dayKey);
            if (rev != null) {
                bucketRevenue.merge(bk, rev, Double::sum);
            }
            Long oc = dailyOrders.get(dayKey);
            if (oc != null) {
                bucketOrderCount.merge(bk, oc, Long::sum);
            }
        }

        NavigableSet<String> allBuckets = new TreeSet<>();
        allBuckets.addAll(bucketRevenue.keySet());
        allBuckets.addAll(bucketOrderCount.keySet());
        List<Map<String, Object>> series = new ArrayList<>();
        for (String bk : allBuckets) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("label", formatSalesBucketLabel(bk, g));
            row.put("revenue", Math.round(bucketRevenue.getOrDefault(bk, 0.0) * 100.0) / 100.0);
            row.put("orders", bucketOrderCount.getOrDefault(bk, 0L).intValue());
            series.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("period", days + " days");
        result.put("grain", g);
        result.put("totalRevenue", Math.round(recentOrders.stream().mapToDouble(o -> o.getTotal() == null ? 0 : o.getTotal().doubleValue()).sum() * 100.0) / 100.0);
        result.put("totalOrders", recentOrders.size());
        result.put("series", series);
        result.put("dailySales", new LinkedHashMap<>(dailySales));
        result.put("dailyOrders", new LinkedHashMap<>(dailyOrders));
        return result;
    }

    public Map<String, Object> getTopProducts(int limit) {
        int cap = Math.max(1, limit);
        List<OrderEntity> orders = orderRepository.findAll();
        Map<String, Double> revenueByProduct = new HashMap<>();
        Map<String, Set<String>> orderIdsByProduct = new HashMap<>();
        for (OrderEntity o : orders) {
            if (o.getItems() == null || o.getId() == null) {
                continue;
            }
            for (OrderItemEntity line : o.getItems()) {
                String pid = line.getProductId();
                if (pid == null) {
                    continue;
                }
                double lineRev = line.getLineTotal() != null ? line.getLineTotal().doubleValue() : 0.0;
                revenueByProduct.merge(pid, lineRev, Double::sum);
                orderIdsByProduct.computeIfAbsent(pid, k -> new HashSet<>()).add(o.getId());
            }
        }

        List<String> topIds = revenueByProduct.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(cap)
                .map(Map.Entry::getKey)
                .toList();

        List<Map<String, Object>> topByOrders = new ArrayList<>();
        for (String pid : topIds) {
            ProductEntity p = productRepository.findById(pid).orElse(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", pid);
            m.put("name", p != null ? p.getTitleEn() : pid);
            m.put("orders", orderIdsByProduct.getOrDefault(pid, Set.of()).size());
            m.put("revenue", Math.round(revenueByProduct.getOrDefault(pid, 0.0) * 100.0) / 100.0);
            m.put("rating", p != null ? p.getRatingAvg() : null);
            topByOrders.add(m);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("topByOrders", topByOrders);
        return result;
    }

    public Map<String, Object> getCustomerAnalytics() {
        long total = userRepository.count();
        List<OrderEntity> orders = orderRepository.findAll();
        Set<String> buyerIds = orders.stream().map(OrderEntity::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCustomers", total);
        result.put("customersWithOrders", buyerIds.size());
        result.put("conversionRate", total > 0 ? Math.round((double) buyerIds.size() / total * 10000.0) / 100.0 : 0);
        return result;
    }

    /**
     * Signup timeline from entity createdAt timestamps.
     */
    public Map<String, Object> getCustomerGrowth(int days, String grain) {
        String g = normalizeGrain(grain);
        LocalDate endDate = LocalDate.now(ZONE);
        LocalDate startDate = endDate.minusDays(Math.max(1, days) - 1L);

        List<UserEntity> users = userRepository.findAll();
        int legacyWithoutJoinDate = 0;
        List<Instant> signupInstants = new ArrayList<>();
        for (UserEntity u : users) {
            Instant created = u.getCreatedAt();
            if (created == null) {
                legacyWithoutJoinDate++;
                continue;
            }
            signupInstants.add(created);
        }

        List<GrowthBucket> buckets = buildGrowthBuckets(startDate, endDate, g);
        List<Map<String, Object>> series = new ArrayList<>();
        for (GrowthBucket b : buckets) {
            long newCustomers = signupInstants.stream()
                    .filter(t -> !t.isBefore(b.startInclusive()) && !t.isAfter(b.endInclusive()))
                    .count();
            long cumulative = signupInstants.stream()
                    .filter(t -> !t.isAfter(b.endInclusive()))
                    .count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("label", b.label());
            row.put("newCustomers", (int) newCustomers);
            row.put("cumulativeCustomers", (int) cumulative);
            series.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("series", series);
        result.put("totalCustomers", users.size());
        result.put("legacyCustomersWithoutJoinDate", legacyWithoutJoinDate);
        result.put("grain", g);
        return result;
    }

    private static String normalizeGrain(String grain) {
        if (grain == null) {
            return "day";
        }
        String g = grain.trim().toLowerCase(Locale.ROOT);
        if ("week".equals(g) || "month".equals(g)) {
            return g;
        }
        return "day";
    }

    private static String toSalesBucketKey(String yyyyMmDd, String grain) {
        LocalDate d = LocalDate.parse(yyyyMmDd);
        if ("month".equals(grain)) {
            return d.getYear() + "-" + String.format("%02d", d.getMonthValue());
        }
        if ("week".equals(grain)) {
            WeekFields wf = WeekFields.ISO;
            int y = d.get(wf.weekBasedYear());
            int w = d.get(wf.weekOfWeekBasedYear());
            return y + "-W" + String.format("%02d", w);
        }
        return yyyyMmDd;
    }

    private static String formatSalesBucketLabel(String bucketKey, String grain) {
        if ("day".equals(grain)) {
            LocalDate d = LocalDate.parse(bucketKey);
            return d.format(DateTimeFormatter.ofPattern("MM/dd"));
        }
        if ("month".equals(grain)) {
            String[] p = bucketKey.split("-");
            if (p.length >= 2) {
                int y = Integer.parseInt(p[0]);
                int m = Integer.parseInt(p[1]);
                return Month.of(m).getDisplayName(TextStyle.SHORT, Locale.US) + " " + String.format("'%02d", y % 100);
            }
        }
        if (bucketKey.contains("-W")) {
            int dash = bucketKey.indexOf("-W");
            try {
                int y = Integer.parseInt(bucketKey.substring(0, dash));
                int w = Integer.parseInt(bucketKey.substring(dash + 2));
                return "W" + w + " '" + String.format("%02d", y % 100);
            } catch (NumberFormatException ignored) {
                return bucketKey;
            }
        }
        return bucketKey;
    }

    private record GrowthBucket(String label, Instant startInclusive, Instant endInclusive) {}

    private List<GrowthBucket> buildGrowthBuckets(LocalDate startDate, LocalDate endDate, String grain) {
        List<GrowthBucket> out = new ArrayList<>();
        if ("day".equals(grain)) {
            for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
                ZonedDateTime zStart = d.atStartOfDay(ZONE);
                ZonedDateTime zEnd = d.plusDays(1).atStartOfDay(ZONE).minusNanos(1);
                String label = d.format(DateTimeFormatter.ofPattern("MM/dd"));
                out.add(new GrowthBucket(label, zStart.toInstant(), zEnd.toInstant()));
            }
            return out;
        }
        if ("week".equals(grain)) {
            LocalDate cursor = startDate.with(DayOfWeek.MONDAY);
            if (cursor.isAfter(startDate)) {
                cursor = cursor.minusWeeks(1);
            }
            WeekFields wf = WeekFields.ISO;
            for (; !cursor.isAfter(endDate); cursor = cursor.plusWeeks(1)) {
                LocalDate monday = cursor;
                LocalDate sunday = monday.plusDays(6);
                ZonedDateTime zStart = monday.atStartOfDay(ZONE);
                ZonedDateTime zEnd = sunday.plusDays(1).atStartOfDay(ZONE).minusNanos(1);
                int y = monday.get(wf.weekBasedYear());
                int w = monday.get(wf.weekOfWeekBasedYear());
                String label = "W" + w + " '" + String.format("%02d", y % 100);
                out.add(new GrowthBucket(label, zStart.toInstant(), zEnd.toInstant()));
            }
            return out;
        }
        YearMonth ym = YearMonth.from(startDate);
        YearMonth endYm = YearMonth.from(endDate);
        for (YearMonth m = ym; !m.isAfter(endYm); m = m.plusMonths(1)) {
            LocalDate first = m.atDay(1);
            LocalDate last = m.atEndOfMonth();
            ZonedDateTime zStart = first.atStartOfDay(ZONE);
            ZonedDateTime zEnd = last.plusDays(1).atStartOfDay(ZONE).minusNanos(1);
            String label = m.getMonth().getDisplayName(TextStyle.SHORT, Locale.US) + " " + String.format("'%02d", m.getYear() % 100);
            out.add(new GrowthBucket(label, zStart.toInstant(), zEnd.toInstant()));
        }
        return out;
    }
}
