import { defineEventHandler } from "h3";
import { proxyToNestApi } from "../../../utils/proxy";

export default defineEventHandler((event) => proxyToNestApi(event, "/promotions"));
