"use strict";

const loopback = require("loopback");

module.exports = function trainCoffees(server) {
    const Coffee = server.models.Coffee;
    Coffee.find({
        where: {
            trained: {
                neq: true
            },
            image: {
                neq: null
            }
        }
    }).then(results => {
        return Promise.all(results.map(coffee => {
            return new Promise((resolve, reject) => {
                coffee.train((err, _coffee) => {
                    if(err){
                        reject(err);
                    }else{
                        resolve(_coffee);
                    }
                })
            })
        }))
    }).then(coffess => {
        console.log('Trained ' + coffess.length +  ' coffees');
    }).catch(err => console.error(err));
};
