const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const path = require("path");

// Parameters
let mode = 'dev';
let region = 'us-east-1';
let imageId = ``;
let bucket = ``;
let stack = ``;
let ecrDockerImageArn = ``;

let app = `workout`;
let useEventBridge = false;
let enableTerminationProtection = false;
let chimeEndpoint = 'https://service.chime.aws.amazon.com'


const packages = [
  // Use latest AWS SDK instead of default version provided by Lambda runtime
  'aws-sdk',
  'uuid',
  'aws-embedded-metrics',
  'lodash'
];

function usage() {
  console.log(`Usage: deploy.sh [-m mode] [-r region] [-b bucket] [-s stack] [-i docker-image] [-a application] [-e]`);
  console.log(`  -m, --mode                           Mode(dev/prod) for deployment`);
  console.log(`  -r, --region                         Target region, default '${region}'`);
  console.log(`  -b, --s3-bucket                      S3 bucket for deployment, required`);
  console.log(`  -s, --stack-name                     CloudFormation stack name, required`);
  console.log(`  -i, --image-arn    Docker image store in ECR, required`);
  console.log(`  -a, --application                    Browser application to deploy, default '${app}'`);
  console.log(`  -e, --event-bridge                   Enable EventBridge integration, default is no integration`);
  console.log(`  -c, --chime-endpoint                 AWS SDK Chime endpoint, default is '${chimeEndpoint}'`);
  console.log(`  -t, --enable-termination-protection  Enable termination protection for the Cloudformation stack, default is false`);
  console.log(`  -h, --help           Show help and exit`);
}

function ensureBucket() {
  const s3Api = spawnSync('aws', ['s3api', 'head-bucket', '--bucket', `${bucket}`, '--region', `${region}`]);
  if (s3Api.status !== 0) {
    console.log(`Creating S3 bucket ${bucket}`);
    const s3 = spawnSync('aws', ['s3', 'mb', `s3://${bucket}`, '--region', `${region}`]);
    if (s3.status !== 0) {
      console.log(`Failed to create bucket: ${s3.status}`);
      console.log((s3.stderr || s3.stdout).toString());
      process.exit(s3.status)
    }
  }
}

function ensureEC2ImageId() {
  // Fetching the ECS optimized AMI for AL2
  // More info: https://aws.amazon.com/premiumsupport/knowledge-center/launch-ecs-optimized-ami/
  imageId = spawnSync('aws', ['ssm', 'get-parameters', 
                              '--names', '/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id', 
                              '--region', `${region}`, 
                              '--query', '"Parameters[0].Value"']);
  if(!imageId.length) {
    // Setting image ID optimized for us-east-1
    // Mode info: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html
    imageId = 'ami-00f69adbdc780866c'; 
  }
}

function getArgOrExit(i, args) {
  if (i >= args.length) {
    console.log('Too few arguments');
    usage();
    process.exit(1);
  }
  return args[i];
}

function parseArgs() {
  var args = process.argv.slice(2);
  var i = 0;
  while (i < args.length) {
    switch (args[i]) {
      case '-h': case '--help':
        usage();
        process.exit(0);
        break;
      case '-m': case '--mode':
        mode = getArgOrExit(++i, args)
        break;
      case '-r': case '--region':
        region = getArgOrExit(++i, args)
        break;
      case '-b': case '--s3-bucket':
        bucket = getArgOrExit(++i, args)
        break;
      case '-s': case '--stack-name':
        stack = getArgOrExit(++i, args)
        break;
      case '-i': case '--docker-image':
        ecrDockerImageArn = getArgOrExit(++i, args)
        break;
      case '-a': case '--application':
        app = getArgOrExit(++i, args)
        break;
      case '-e': case '--event-bridge':
        useEventBridge = true;
        break;
      case '-c': case '--chime-endpoint':
        chimeEndpoint = getArgOrExit(++i, args)
        break;
      case '-t': case '--enable-termination-protection':
        enableTerminationProtection = true;
        break;
      default:
        console.log(`Invalid argument ${args[i]}`);
        usage();
        process.exit(1)
    }
    ++i;
  }
  if (!stack.trim() || !bucket.trim() || !ecrDockerImageArn.trim()) {
    console.log('Missing required parameters');
    usage();
    process.exit(1);
  }
}

function spawnOrFail(command, args, options, printOutput = true) {
  options = {
    ...options,
    shell: true
  };
  const cmd = spawnSync(command, args, options);
  if (cmd.error) {
    console.log(`Command ${command} failed with ${cmd.error.code}`);
    process.exit(255);
  }
  const output = cmd.stdout.toString();
  if (printOutput) {
    console.log(output);
  }
  if (cmd.status !== 0) {
    console.log(`Command ${command} ${JSON.stringify(args)} failed with exit code ${cmd.status} signal ${cmd.signal}`);
    console.log(cmd.stderr.toString());
    process.exit(cmd.status)
  }
  return output;
}
function spawnOrFail1(command, args, options) {
  const cmd = spawnSync(command, args, options);
  if (cmd.error) {
    console.log(`Command ${command} failed with ${cmd.error.code}`);
    process.exit(255);
  }
  const output=cmd.stdout.toString();
  
  if (cmd.status !== 0) {
    console.log(`Command ${command} ${JSON.stringify(args)} failed with exit code ${cmd.status} signal ${cmd.signal}`);
    console.log(cmd.stderr.toString());
    process.exit(cmd.status);
  }
  return output;
}

function appHtml(appName) {
  return `../browser/dist/${appName}.html`
}

function ensureApp(appName) {
  console.log(`Verifying application ${appName}`);
  if (!fs.existsSync(`../browser/app/${appName}`)) {
    console.log(`Application ${appName} does not exist. Did you specify correct name?`);
    process.exit(1);
  }
  if (!fs.existsSync(appHtml(appName))) {
    console.log(`Application ${appHtml(appName)} does not exist. Rebuilding demo apps`);
    spawnOrFail('npm', ['run', 'build', `--app=${appName}`], { cwd: path.join(__dirname, '..', 'browser') });
  }
}

function ensureTools() {
  spawnOrFail('aws', ['--version']);
  spawnOrFail('sam', ['--version']);
  spawnOrFail('npm', ['install']);
}

parseArgs();
ensureTools();
ensureApp(app);
if (app === 'workout') {
  ensureApp('bot');
}

if (!fs.existsSync('build')) {
  fs.mkdirSync('build');
}

console.log(`Using region ${region}, bucket ${bucket}, stack ${stack}, endpoint ${chimeEndpoint}, enable-termination-protection ${enableTerminationProtection}`);
ensureEC2ImageId();
ensureBucket();

for (const package of packages) {
  spawnOrFail('npm', ['install', '--production', '--legacy-peer-deps'], { cwd: path.join(__dirname, 'node_modules', package) });
  fs.removeSync(path.join(__dirname, 'src', package));
  fs.copySync(path.join(__dirname, 'node_modules', package), path.join(__dirname, 'src', package));
}

fs.copySync(appHtml(app), 'src/indexWorkout.html');
if (app === 'workout') {
  fs.copySync(appHtml('bot'), 'src/indexBot.html');
}

if ( mode != 'prod' )
  mode = 'dev';
spawnOrFail('sam', ['package', '--s3-bucket', `${bucket}`,
  '--template-file', `template_${mode}.yaml`,
  `--output-template-file`, `build/packaged.yaml`,
  '--region', `${region}`]);
console.log('Deploying serverless application');
const output=spawnOrFail('sam', ['deploy', '--template-file', './build/packaged.yaml', '--stack-name', `${stack}`,
  '--parameter-overrides',`ECRDockerImageArn=${ecrDockerImageArn} UseEventBridge=${useEventBridge} ChimeEndpoint=${chimeEndpoint}`,
  '--capabilities', 'CAPABILITY_IAM', '--region', `${region}`, '--no-fail-on-empty-changeset']);
console.log(output);
if (enableTerminationProtection) {
  spawnOrFail('aws', ['cloudformation', 'update-termination-protection', '--enable-termination-protection', '--stack-name', `${stack}`], null, false);
}
console.log("Webfitness Trainingroom URL: ");
const invokeUrl = spawnOrFail('aws', ['cloudformation', 'describe-stacks', '--stack-name', `${stack}`,
  '--query', 'Stacks[0].Outputs[0].OutputValue', '--output', 'text', '--region', `${region}`]);
if (app === 'workout') {
  console.log(invokeUrl.replace(/Prod/, 'Prod/workout'));
  console.log(invokeUrl.replace(/Prod/, 'Prod/member'));
  console.log(invokeUrl.replace(/Prod/, 'Prod/bot'));
  console.log(`Bot Handler API Gateway invoke URL: ${invokeUrl.replace(/Prod/, 'Prod/bothandler')}`);
}
const ecsClusterName=spawnOrFail1('aws', ['cloudformation', 'describe-stacks', '--stack-name', `${stack}`,
                    '--query', 'Stacks[0].Outputs[1].OutputValue', '--output', 'text', '--region', `${region}`]).trim();
console.log('Adding ECS capacity provider and enabling managed scaling & termination protection');
spawnOrFail1('aws', ['configure', 'set', 'default.region', `${region}`]);
//aws configure set region us-west-1

const autoScalingGroupName=spawnOrFail1('aws', ['cloudformation', 'describe-stacks', '--stack-name', `${stack}`,
                    '--query', 'Stacks[0].Outputs[2].OutputValue', '--output', 'text', '--region', `${region}`]).trim();

// Enabling instance termination perotection from scale-in
spawnSync('aws', ['autoscaling', 'update-auto-scaling-group', 
                    '--auto-scaling-group-name', `${autoScalingGroupName}`, '--new-instances-protected-from-scale-in']);
const asg = JSON.parse(spawnOrFail('aws', ['autoscaling', 'describe-auto-scaling-groups', '--auto-scaling-group-name', `${autoScalingGroupName}`]));
const autoScalingGroupInstances = asg.AutoScalingGroups && asg.AutoScalingGroups[0].Instances;
const autoScalingGroupArn = asg.AutoScalingGroups && asg.AutoScalingGroups[0].AutoScalingGroupARN;
const autoScalingGroupCapacityProviderName = autoScalingGroupName + 'CapacityProvider';
var instanceIds = [];
autoScalingGroupInstances.forEach(instance => {
  instanceIds.push(instance.InstanceId);
});

spawnOrFail1('aws', ['autoscaling', 'set-instance-protection', 
                    '--auto-scaling-group-name', `${autoScalingGroupName}`, 
                    '--protected-from-scale-in', '--instance-ids', `${instanceIds[0]}`]);//, `${instanceIds[1]}`]);

// Create a capacity provider with managed scale-in
let capacityProviderParam = {
  autoScalingGroupArn: autoScalingGroupArn,
  managedScaling: {
    status: "ENABLED",
    targetCapacity: 60,
    minimumScalingStepSize: 1,
    maximumScalingStepSize: 1
  },
  managedTerminationProtection: "ENABLED"
}

spawnOrFail1('aws', ['ecs', 'create-capacity-provider', 
                    '--name', `${autoScalingGroupCapacityProviderName}`, '--auto-scaling-group-provider', 
                    `${JSON.stringify(capacityProviderParam)}`]);
let defaultCapacityProvider = {
    capacityProvider: autoScalingGroupCapacityProviderName
  }

spawnOrFail1('aws', ['ecs', 'put-cluster-capacity-providers', 
                    '--cluster', `${ecsClusterName}`, '--capacity-providers', `${autoScalingGroupCapacityProviderName}`, 
                    '--default-capacity-provider-strategy', `${JSON.stringify(defaultCapacityProvider)}`]);
console.log('Deployment complete')

