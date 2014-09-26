#!/usr/bin/env node

var params = require('minimist')(process.argv.slice(2));
var fs = require("fs");
var colors = require('colors');
var expand = require("glob-expand");
var esprima = require("esprima");
var path = require("path");
var util = require("util");
var estraverse = require("estraverse");
var exec = require("child_process").exec;
var sys = require("sys");
var async = require("async");

var ignore = [
    "util",
    "vm",
    "url",
    "path",
    "fs",
    "http",
    "stream",
    "sys",
    "child_process"
];

var ignoreFiles = [
    "Gruntfile.js"
];

if (!params.dir && params._.length > 0)
    params.dir = params._[0];

if (!params.dir || params.dir == "./")
    params.dir = process.cwd();

if (params.dir[0] == ".")
    params.dir = path.join(process.cwd(), params.dir);

if (params.ignore) {
    ignoreFiles = params.ignore.split(";");
}

for (var x in ignoreFiles)
    ignoreFiles[x] = "!**/" + ignoreFiles[x];

console.log();
console.log("Scanning for " + "require()".magenta + " in " + params.dir.yellow);
console.log();

var files = expand({filter: 'isFile', cwd: params.dir}, ['**/*.js', '!**/node_modules/**'].concat(ignoreFiles));
var requires = [];
for (var x in files) {
    try {
        var tree = esprima.parse(fs.readFileSync(path.join(params.dir, files[x])).toString()); //

        estraverse.traverse(tree, {
            enter: function(node, parent) {

                //console.log(node);
                //console.log();
                if (
                        node.type == "CallExpression"
                        && node.callee.type == "Identifier"
                        && node.callee.name == "require"
                        && node.arguments[0].type == "Literal"
                        ) {
                    if (node.arguments[0].value[0] !== "." && node.arguments[0].value[0] !== "/" && ignore.indexOf(node.arguments[0].value) === -1) {
                        console.log("Found " + node.arguments[0].value.green + " in " + files[x].yellow)
                        requires.push(node.arguments[0].value)
                    }


                }

            },
            leave: function(node, parent) {

            }
        });

    } catch (err) {
        console.log("Parse error".red + " in " + files[x].yellow)
    }

}

var deduped = [];

for (var x in requires) {
    if (deduped.indexOf(requires[x]) === -1)
        deduped.push(requires[x]);
}

requires = deduped;

console.log();
console.log("Attempting to detect versions...");
console.log();

var versions = {};
var promises = [];
var currents = {};

async.forEach(requires, function(name, cb) {

    exec("npm view " + name + " --json --quiet", function(error, stdout, stderr) {
        //sys.print(stdout);

        //sys.print(stderr.red);
        if (error !== null) {
            currents[name] = "unknown";
        } else {

            try {
                var info = JSON.parse(stdout);
            } catch (err) {
                currents[name] = "unknown";
            }

            currents[name] = info.versions[info.versions.length - 1];

        }

        cb();

    });

}, function(err) {

    for (var x in requires) {
        try {

            var package = require(path.join(params.dir, "/node_modules/" + requires[x] + "/package.json"));

            console.log(requires[x].green + " is version " + package.version.cyan + " (Current: ".grey + currents[requires[x]].grey + ")".grey);
            versions[requires[x]] = package.version;

        } catch (err) {
            console.log(requires[x].green + " is version " + "unknown".red+ " (Current: ".grey + currents[requires[x]].grey + ")".grey);
            versions[requires[x]] = false;
        }
    }


    if (params.save) {
        console.log();
        console.log("Saving to " + "package.json".yellow + "...");

        var install = [];

        for (var x in requires) {
            install.push(requires[x] + "@" + versions[requires[x]]);
        }

        child = exec("cd " + params.dir + " && npm install " + install.join(" ") + " --save", function(error, stdout, stderr) {
            //sys.print(stdout);

            //sys.print(stderr.red);
            if (error !== null) {

                console.log();
                console.log("Error. ".red + "failed to save " + "package.json".yellow);
            } else {
                console.log();
                console.log("Success! " + "package.json".yellow + " has been updated.");
            }
        });
    } else {
        console.log();
        console.log("This was just a test run. " + "package.json".yellow + " has not been modified.  Use " + "--save".blue + " to update " + "package.json".yellow + ".");
    }

//console.log(versions);

});







