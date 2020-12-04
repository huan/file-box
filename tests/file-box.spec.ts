#!/usr/bin/env ts-node

import { test }  from 'tstest'
import fs from 'fs'
import path from 'path'
import FileBox from '../src'

test.only('should be able support multi toFile() for a stream FileBox', async (t) => {
  // Prepare
  const fileContent = 'test'
  const fileName = 'test.txt'
  const tempFolder = path.join(__dirname, 'temp')
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder)
  }
  const inputFilePath = path.join(tempFolder, fileName)
  const outputFile1Path = path.join(tempFolder, 'outputFile1.txt')
  const outputFile2Path = path.join(tempFolder, 'outputFile2.txt')
  fs.writeFileSync(inputFilePath, fileContent, { encoding: 'utf-8' })

  const fileStream = fs.createReadStream(inputFilePath)
  const streamFileBox = FileBox.fromStream(fileStream, fileName)

  await streamFileBox.toFile(outputFile1Path)
  await streamFileBox.toFile(outputFile2Path)

  const file1Data = fs.readFileSync(outputFile1Path, { encoding: 'utf-8' })
  const file2Data = fs.readFileSync(outputFile2Path, { encoding: 'utf-8' })

  t.equal(file1Data, fileContent)
  t.equal(file2Data, fileContent)

  fs.unlinkSync(inputFilePath)
  fs.unlinkSync(outputFile1Path)
  fs.unlinkSync(outputFile2Path)
  if (fs.existsSync(tempFolder)) {
    fs.rmdirSync(tempFolder)
  }
})
