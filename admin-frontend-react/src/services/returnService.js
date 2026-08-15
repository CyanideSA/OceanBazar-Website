import { api } from "../lib/api";
import { normalizeReturn } from "../lib/normalize";

function mapList(data) {
  const rows = Array.isArray(data) ? data : data?.returns || data?.items || [];
  return rows.map(normalizeReturn);
}

function withReauth(reauthToken) {
  return reauthToken ? { headers: { "x-admin-reauth-token": reauthToken } } : {};
}

/** Detail endpoint returns { returnRequest, order, refundRecords, courierShipments } — flatten before normalizing. */
function mapDetail(data) {
  const rr = data?.returnRequest || data;
  return normalizeReturn({
    ...rr,
    order: data?.order ?? rr?.order,
    refundRecords: data?.refundRecords ?? rr?.refundRecords,
    courierShipments: data?.courierShipments ?? rr?.courierShipments,
  });
}

export const returnService = {
  list: (status) =>
    api.get("/api/admin/returns", { params: status ? { status } : {} }).then((r) => mapList(r.data)),
  getById: (id) => api.get(`/api/admin/returns/${id}`).then((r) => mapDetail(r.data)),

  updateStatus: (id, status, note) =>
    api.patch(`/api/admin/returns/${id}/status`, { status, note }).then((r) => mapDetail(r.data)),

  approve: (id, note) => api.post(`/api/admin/returns/${id}/approve`, { note }).then((r) => mapDetail(r.data)),
  reject: (id, note) => api.post(`/api/admin/returns/${id}/reject`, { note }).then((r) => mapDetail(r.data)),

  bookCourierAssign: (id, { courier, recipientPhone, recipientAddress, note }) =>
    api.post(`/api/admin/returns/${id}/courier`, {
      mode: "assign", courier, recipientPhone, recipientAddress, note,
    }).then((r) => mapDetail(r.data)),
  bookCourierManual: (id, { trackingNumber, carrier, note }) =>
    api.post(`/api/admin/returns/${id}/courier`, {
      mode: "manual", trackingNumber, carrier, note,
    }).then((r) => mapDetail(r.data)),

  markReceived: (id, note) => api.post(`/api/admin/returns/${id}/received`, { note }).then((r) => mapDetail(r.data)),
  markUnderReview: (id, note) => api.post(`/api/admin/returns/${id}/under-review`, { note }).then((r) => mapDetail(r.data)),
  markRefundEligible: (id, refundAmount, note) =>
    api.post(`/api/admin/returns/${id}/refund-eligible`, { refundAmount, note }).then((r) => mapDetail(r.data)),

  confirmRefund: (id, { amount, method, reference, notes }, reauthToken) =>
    api.post(`/api/admin/returns/${id}/refund-confirm`, { amount, method, reference, notes }, withReauth(reauthToken))
      .then((r) => mapDetail(r.data)),

  close: (id, note) => api.post(`/api/admin/returns/${id}/close`, { note }).then((r) => mapDetail(r.data)),

  processRefund: (id, amount, method, note, reauthToken) =>
    api.post(
      `/api/admin/returns/${id}/refund`,
      { amount, method, note },
      withReauth(reauthToken)
    ).then((r) => mapDetail(r.data)),
};
