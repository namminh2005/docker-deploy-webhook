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
const services = require(`./config.json`)[process.env.CONFIG || 'production']

if (!process.env.TOKEN || !process.env.USERNAME || !process.env.PASSWORD)
  return console.error("Error: You must set a TOKEN, USERNAME and PASSWORD as environment variables.")

const dockerCommand = process.env.DOCKER || '/usr/bin/docker'
const token = process.env.TOKEN || ''
const username = process.env.USERNAME || ''
const password = process.env.PASSWORD || ''
const registry = process.env.REGISTRY || ''

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout ? stdout : {
        'error': error,
        'stderr': stderr
      });
    });
  });
}

app.post('/webhook/:token', async (req, res) => {
  if (!req.params.token || req.params.token != token) {
    console.log("Webhook called with invalid or missing token.")
    return res.status(401).send('Access Denied: Token Invalid\n').end()
  }

  // Send response back right away if token was valid
  res.send('OK')

  const payload = req.body
  const image = `${payload.repository.repo_name}:${payload.push_data.tag}`

  if (!services[image]) return console.log(`Received updated for "${image}" but not configured to handle updates for this image.`)

  const LIST_CLI = services[image].cli

  for(let key in LIST_CLI){
    let test = await execShellCommand(LIST_CLI[key]);
    if(test.error){
      console.error(`Failed to deploy ${image}`);
      return console.error(test.stderr)
    }
  }

  console.log(`Deployed ${image} successfully and restarted the docker-compose.`)
})

app.all('*', (req, res) => {
  res.send('')
})

app.listen(process.env.PORT, err => {
  if (err) throw err
  console.log(`Listening for webhooks on http://localhost:${process.env.PORT}/webhook/${token}`)
})
