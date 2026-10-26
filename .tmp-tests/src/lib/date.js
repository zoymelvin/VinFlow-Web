"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemDate = getSystemDate;
exports.getSystemTime = getSystemTime;
const utils_1 = require("./insights/utils");
function getSystemDate() {
    return (0, utils_1.formatYYYYMMDD)(new Date());
}
function getSystemTime() {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
