// src/api/services/employeeService.ts
import API from "../api";

type ApiHeaders = Record<string, string>;

export type EmployeeRole = "employee" | "inventorist" | "admin";

export type EmployeePermissions = {
inventory: boolean;
sales: boolean;
reports: boolean;
orders: boolean;
employees: boolean; // gérer employés (réservé owner/admin côté backend)
};

export type Employee = {
_id: string;
phone: string;
name?: string;
role: EmployeeRole;
isActive?: boolean;
permissions?: Partial<EmployeePermissions>;
createdAt?: string;

inviteToken?: string;
inviteUrl?: string;
expiresAt?: string;
};

export type CreateEmployeePayload = {
phone: string;
name?: string;
role?: EmployeeRole;
permissions?: Partial<EmployeePermissions>;
};

export type UpdateEmployeePayload = {
name?: string;
role?: EmployeeRole;
permissions?: Partial<EmployeePermissions>;
};

/* ================== helpers (béton) ================== */
function normalizeHeaders(headers?: ApiHeaders): ApiHeaders {
const h = { ...(headers || {}) };
if (!h.Authorization || !String(h.Authorization).trim()) delete (h as any).Authorization;
return h;
}

function requireEmployeeId(employeeId: string) {
const id = String(employeeId || "").trim();
if (!id) throw new Error("employeeId manquant");
return id;
}

/* ================== API ================== */
export const listEmployees = async (headers: ApiHeaders): Promise<Employee[]> => {
const res = await API.get<Employee[]>("/employees", { headers: normalizeHeaders(headers) });
return res.data;
};

export const createEmployee = async (
payload: CreateEmployeePayload,
headers: ApiHeaders
): Promise<Employee> => {
const res = await API.post<Employee>("/employees", payload, { headers: normalizeHeaders(headers) });
return res.data;
};

export const updateEmployee = async (
employeeId: string,
payload: UpdateEmployeePayload,
headers: ApiHeaders
): Promise<Employee> => {
const id = requireEmployeeId(employeeId);
const res = await API.patch<Employee>(`/employees/${id}`, payload, { headers: normalizeHeaders(headers) });
return res.data;
};

export const toggleEmployee = async (employeeId: string, headers: ApiHeaders): Promise<Employee> => {
const id = requireEmployeeId(employeeId);
const res = await API.patch<Employee>(`/employees/${id}/toggle`, {}, { headers: normalizeHeaders(headers) });
return res.data;
};

export const deleteEmployee = async (
employeeId: string,
headers: ApiHeaders
): Promise<{ message: string }> => {
const id = requireEmployeeId(employeeId);
const res = await API.delete<{ message: string }>(`/employees/${id}`, { headers: normalizeHeaders(headers) });
return res.data;
};
