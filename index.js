/**
 * A service for automated deployment from Docker Hub to Docker Swarm
 * https://docs.docker.com/docker-hub/webhooks/
 */

var winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/info.log', level: 'info' }),
    new winston.transports.File({ filename: 'logs/debug.log', level: 'debug' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

process.env.PORT = process.env.PORT || 3000

const express = require('express')
const bodyParser = require('body-parser')
const child_process = require('child_process')
const app = express()
const Package = require('./package.json')
const images = require(`./conf/config.json`)[process.env.CONFIG || 'production'];

if (!process.env.TOKEN)
  return writeErrorLogWithDate("Error: You must set a TOKEN, USERNAME and PASSWORD as environment variables.")

const token = process.env.TOKEN || ''
const dockerAuth = {
  userName: process.env.DOCKER_USERNAME || '',
  password: process.env.DOCKER_PASSWORD || ''
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        writeErrorLogWithDate(error);
        throw new Error(error);
      }
      resolve(stdout.trim());
    });
  });
}

function writeLogWithDate(log){
  var datetime = new Date();
  logger.info(`${datetime}: ${log}`);
}

function writeErrorLogWithDate(log){
  var datetime = new Date();
  logger.error(`${datetime}: ${log}`);
}

app.post('/webhook/:token', async (req, res) => {
  if (!req.params.token || req.params.token != token) {
    writeErrorLogWithDate('Webhook called with invalid or missing token.');
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

  // Stop container
  await execShellCommand(`docker container stop ${containerId}`);

  // Remove container
  await execShellCommand(`docker container rm ${containerId}`);

  // Login docker hub
  if(dockerAuth.userName && dockerAuth.password){
    await execShellCommand(`docker login -u ${dockerAuth.userName} -p '${dockerAuth.password}'`);
  }

  // Pull image
  await execShellCommand(`docker pull ${image}`);

  // Generate string to create container
  let generateDockerRunShell = 'docker create -it';
  
  // Container labels
  let containerLabels = containerDetail[0].Config.Labels;
  for(let key in containerLabels){
    generateDockerRunShell += (` -l ${key}=${containerLabels[key]}`);
  }

  // Container name
  let containerName = containerDetail[0].Name.substr(1, containerDetail[0].Name.length - 1);
  generateDockerRunShell += (` --name ${containerName}`);

  // Container port
  let containerPorts = containerDetail[0].NetworkSettings.Ports;
  for(let containerPort in containerPorts){
    containerPorts[containerPort].forEach(element => {
      let hostPort = element["HostPort"];
      let hostIp = element["HostIp"];
      generateDockerRunShell += (` -p ${hostPort}:${containerPort}`)
    });
  }

  // Use image
  generateDockerRunShell += (` ${image}`);

  // Call command
  await execShellCommand(generateDockerRunShell);

  // Container Networks
  let hostName = containerDetail[0].Config.Hostname;
  let containerNetworks = containerDetail[0].NetworkSettings.Networks;
  for(let key in containerNetworks){
    let links = containerNetworks[key].Links;
    let aliases = containerNetworks[key].Aliases;
    let dockerNetworkCmd = 'docker network connect';
    for(let keyl in links){
      dockerNetworkCmd += (' --link ' + links[keyl]);
    }
    for(let keya in aliases){
      if(aliases[keya] == hostName) continue;
      dockerNetworkCmd += (' --alias ' + aliases[keya]);
    }
    await execShellCommand(dockerNetworkCmd + ` ${key} ${containerName}`);
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