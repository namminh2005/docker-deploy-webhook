/**
 * A service for automated deployment from Docker Hub to Docker Swarm
 * https://docs.docker.com/docker-hub/webhooks/
 */
process.env.PORT = process.env.PORT || 3000

const express = require('express')
const bodyParser = require('body-parser')
const child_process = require('child_process')
const app = express()
const Package = require('./package.json')
const images = require(`./conf/config.json`)[process.env.CONFIG || 'production']

if (!process.env.TOKEN)
  return writeLogWithDate("Error: You must set a TOKEN, USERNAME and PASSWORD as environment variables.")

const token = process.env.TOKEN || ''

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        writeLogWithDate(error);
      }
      resolve(stdout.trim());
    });
  });
}

function writeLogWithDate(log){
  var datetime = new Date();
  console.log(`${datetime}: ${log}`);
}

app.post('/webhook/:token', async (req, res) => {
  if (!req.params.token || req.params.token != token) {
    writeLogWithDate('Webhook called with invalid or missing token.');
    return res.status(401).send('Access Denied: Token Invalid\n').end()
  }

  // Send response back right away if token was valid
  res.send('OK')

  const payload = req.body
  const image = `${payload.repository.repo_name}:${payload.push_data.tag}`

  if (!images.includes(image)) return writeLogWithDate(`Received updated for "${image}" but not configured to handle updates for this image.`)

  writeLogWithDate(`Start. Pulling Image = "${image}" and recreate all Containers of that.`);

  let containerId = await execShellCommand(`docker container ls --filter ancestor=${image} -q`);
  if(!containerId) return writeLogWithDate('End. No have containers.');

  let containerDetailStr = await execShellCommand(`docker container inspect ${containerId}`);
  let containerDetail = JSON.parse(containerDetailStr);
  await execShellCommand(`docker container stop ${containerId}`);
  await execShellCommand(`docker container rm ${containerId}`);
  await execShellCommand(`docker pull ${image}`);

  let generateDockerRunShell = 'docker container create -it';
  let containerLabels = containerDetail[0].Config.Labels;
  let containerNetworks = containerDetail[0].NetworkSettings.Networks;
  let containerName = containerDetail[0].Name.substr(1, containerDetail[0].Name.length - 1);
  for(let key in containerLabels){
    generateDockerRunShell += (` -l ${key}=${containerLabels[key]}`);
  }
  generateDockerRunShell += (` --name ${containerName}`);
  generateDockerRunShell += (` ${image}`);
  await execShellCommand(generateDockerRunShell);

  for(let key in containerNetworks){
    await execShellCommand(`docker network connect ${key} ${containerName}`);
  }

  await execShellCommand(`docker container start ${containerName}`);

  writeLogWithDate(`End. Pulled Image = "${image}" and recreated all Containers of that`);
})

app.all('*', (req, res) => {
  res.send('')
})

app.listen(process.env.PORT, err => {
  if (err) throw err
  writeLogWithDate(`Listening for webhooks on http://localhost:${process.env.PORT}/webhook/${token}`)
})