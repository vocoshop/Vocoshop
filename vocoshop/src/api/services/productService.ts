import API from "../api";

export const createProduct = async (data: any, config?: any) => {
const res = await API.post("/products", data, config);
return res.data;
};

export const getProducts = async (config?: any) => {
const res = await API.get("/products", config);
return res.data;
};
