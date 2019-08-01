/**
 * A service for automated deployment from Docker Hub
 * https://docs.docker.com/docker-hub/webhooks/
 */
process.env.PORT = process.env.PORT || 3000

const express = require('express')
const bodyParser = require('body-parser')
const child_process = require('child_process')
const app = express()
const Package = require('./package.json')
const images = require(`./config.json`)[process.env.CONFIG || 'production']

if (!process.env.TOKEN)
  return console.error("Error: You must set a TOKEN, USERNAME and PASSWORD as environment variables.")

const token = process.env.TOKEN ||

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function execShellCommand(cmd) {
  //console.log(cmd);
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      else{
        //console.warn(`Result = "${stdout}"`);
      }
      resolve(stdout ? stdout.trim() : {
        'error': error,
        'stderr': stderr
      });
    });
  });
}

app.post('/webhook/:token', async (req, res) => {
  if (!req.params.token || req.params.token != token) {
    console.log("Webhook called with invalid or missing token.");
    return res.status(401).send('Access Denied: Token Invalid\n').end();
  }

  // Send response back right away if token was valid
  res.send('OK');

  const payload = req.body;
  const image = `${payload.repository.repo_name}:${payload.push_data.tag}`;

  console.log(`Start pull Image ="${image}" and recreate all Containers`);
  if (!images.includes(image)) return console.log(`Received updated for "${image}" but not configured to handle updates for this image.`)

  let containerId = await execShellCommand(`docker container ls --filter ancestor=${image} -q`);
  let containerDetailStr = await execShellCommand(`docker container inspect ${containerId}`);
  let containerDetail = JSON.parse(containerDetailStr);
  await execShellCommand(`docker container stop ${containerId}`);
  await execShellCommand(`docker container rm ${containerId}`);
  await execShellCommand(`docker pull ${image}`);

  let generateDockerRunShell = 'docker run -dit';
  let containerLabels = containerDetail[0].Config.Labels;
  let containerNetworks = containerDetail[0].NetworkSettings.Networks;
  let containerName = containerDetail[0].Name.substr(1, containerDetail[0].Name.length - 1);
  for(let key in containerLabels){
    generateDockerRunShell += (` -l ${key}=${containerLabels[key]}`);
  }
  for(let key in containerNetworks){
    generateDockerRunShell += (` --network=${key}`);
  }
  generateDockerRunShell += (` --name ${containerName}`);
  generateDockerRunShell += (` ${image}`);
  await execShellCommand(generateDockerRunShell);

  console.log(`Pulled Image ="${image}" successfully and restarted all Containers.`)
})

app.all('*', (req, res) => {
  res.send('')
})

app.listen(process.env.PORT, err => {
  if (err) throw err
  console.log(`Listening for webhooks on http://localhost:${process.env.PORT}/webhook/${token}`)
})
