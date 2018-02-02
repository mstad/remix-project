const async = require('async')
const path = require('path')
const fs = require('fs')
require('colors')

let Compiler = require('./src/compiler.js')
let Deployer = require('./src/deployer.js')
let TestRunner = require('./src/testRunner.js')

var runTestFiles = function (filepath, isDirectory, web3) {
  async.waterfall([
    function compile (next) {
      Compiler.compileFileOrFiles(filepath, isDirectory, next)
    },
    function deployAllContracts (compilationResult, next) {
      Deployer.deployAll(compilationResult, web3, function (err, contracts) {
        if (err) {
          next(err)
        }

        next(null, compilationResult, contracts)
      })
    },
    function determineTestContractsToRun (compilationResult, contracts, next) {
      let contractsToTest = []
      if (isDirectory) {
        fs.readdirSync(filepath).forEach(filename => {
          if (filename.indexOf('_test.sol') < 0) {
            return
          }
          Object.keys(compilationResult[path.basename(filename)]).forEach(contractName => {
            contractsToTest.push(contractName)
          })
        })
      } else {
        contractsToTest = Object.keys(compilationResult[path.basename(filepath)])
      }

      next(null, contractsToTest, contracts)
    },
    function runTests (contractsToTest, contracts, next) {
      let totalPassing = 0
      let totalFailing = 0

      var testCallback = function (result) {
        if (result.type === 'contract') {
          console.log('\n  ' + result.value)
        } else if (result.type === 'testPass') {
          console.log('\t✓ '.green.bold + result.value.grey)
        } else if (result.type === 'testFailure') {
          console.log('\t✘ '.bold.red + result.value.red)
        }
      }
      var resultsCallback = function (_err, result, cb) {
        totalPassing += result.passingNum
        totalFailing += result.failureNum
        cb()
      }

      async.eachOfLimit(contractsToTest, 1, (contractName, index, cb) => {
        TestRunner.runTest(contractName, contracts[contractName], testCallback, (err, result) => {
          if (err) {
            return cb(err)
          }
          resultsCallback(null, result, cb)
        })
      }, function(err, _results) {
        if (err) {
          return next(err)
        }

        console.log("\n")
        if (totalPassing > 0) {
          console.log(("  " + totalPassing + ' passing').green)
        }
        if (totalFailing > 0) {
          console.log(("  " + totalFailing + ' failing').red)
        }
        console.log("")

        next();
      })
    }
  ], function () {
  })
}

module.exports = {
  runTestFiles: runTestFiles,
  runTest: TestRunner.runTest
}
