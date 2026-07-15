import { api } from "../lib/api";
import { normalizeReturn } from "../lib/normalize";

function mapList(data) {
  const rows = Array.isArray(data) ? data : data?.returns || data?.items || [];
  return rows.map(normalizeReturn);
}

export const returnService = {
  list: (status) =>
    api.get("/api/admin/returns", { params: status ? { status } : {} }).then((r) => mapList(r.data)),
  getById: (id) =>
    api.get(`/api/admin/returns/${id}`).then((r) => normalizeReturn(r.data?.returnRequest || r.data)),
  updateStatus: (id, status, note) =>
    api.patch(`/api/admin/returns/${id}/status`, { status, note }).then((r) =>
      normalizeReturn(r.data?.returnRequest || r.data)
    ),
  processRefund: (id, amount, method, note, reauthToken) =>
    api.post(
      `/api/admin/returns/${id}/refund`,
      { amount, method, note },
      reauthToken ? { headers: { "x-admin-reauth-token": reauthToken } } : {}
    ).then((r) =>
      normalizeReturn(r.data?.returnRequest || r.data)
    ),
};
