const fs = require('fs');
global.load = function (file) {
    var body = fs.readFileSync(file, {encoding:'utf8'});
    eval.call(global, body);
};

load("script.js")

const OUTPUT_PATH = "./output/";
const converter = require('json-2-csv');

(async () => {
    console.log("generating data");

    data = [];
    for(var i = 0; i < 1000; i++) {
        generateData(1000, i);
        console.log("data generated: " + i + "/1000");
    }

    console.log("data generated");

    const csv = await converter.json2csv(data);
    fs.writeFileSync(OUTPUT_PATH + 'data.csv', csv);

    console.log("data saved");
})();