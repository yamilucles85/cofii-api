"use strict"

const assert = require("assert");
const request = require("supertest")
const coffeeMethods = require("../common/models/coffee");

describe("Coffee methods with brand name filter", () => {

    const app = require("../server/server");

    it("it should succeed query, return an instance of brand_coffee", (done) => {
        request(app).get("/coffee/explora")
        .

    });

    it("it should failed query, return an instance of brand_coffee", (done) => {

    });

});

describe("Coffee with other filters", () => {

    it("it should succeed query, return an instance of brand_coffee", (done) => {

    });

    it("it should failed query, return an instance of brand_coffee", (done) => {

    });

});