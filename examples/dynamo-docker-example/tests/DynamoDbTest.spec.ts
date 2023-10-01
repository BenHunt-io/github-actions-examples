import { afterAll, afterEach, test } from "@jest/globals";
import * as Dockerode from 'dockerode'
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


let container : Dockerode.Container | undefined;

test("create, start, and stop dynamodb container", async () => {

    let docker = new Dockerode({socketPath: "/var/run/docker.sock"});
    let container = await startNewDatabaseContainer();

    let containers = await docker.listContainers();
    containers.forEach(container => console.log(`Container Image: ${container.Image}`));

    let client = createDefaultClient();

    let listTableResult = await client.send(new ListTablesCommand({}))
    console.log(`Tables Created: ${listTableResult.TableNames}`);


}, 20000)

afterEach(async () => {
    if(container)
        await container.stop();
})

function createDefaultClient(){
    return DynamoDBDocumentClient.from(new DynamoDBClient({
        endpoint: "http://localhost:8000",
        region: "none",
        credentials: {
            accessKeyId: "1234",
            secretAccessKey: "1234"
        }
    }));
}

function createClient(){
    return DynamoDBDocumentClient.from(new DynamoDBClient({
        endpoint: "http://localhost:8000",
        region: "us-east-1",
        credentials: {
            accessKeyId: "AKIAY2DVPHISL54MHDMN",
            secretAccessKey: "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"
        }
    }));


}

async function startNewDatabaseContainer(){

    let startTime = new Date().getTime();
    let docker = new Dockerode({socketPath: "/var/run/docker.sock"});

    console.log("creating image")
    await docker.createImage({
        fromImage: "amazon/dynamodb-local:latest"
        
    });

    // wait for image to be created
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log("creating container from image")

     let container = await docker.createContainer({
        Image: 'amazon/dynamodb-local:latest',
        AttachStdout: true,
        AttachStderr: true,
        ExposedPorts: {
          '8000/tcp': {}
        },
        HostConfig: {
            PortBindings: { '8000/tcp': [{ HostPort: '8000' }] }
        }
    })

    console.log("created container");

    await container.start();

    console.log("started container");

    let client = createClient();

    let waitCondition = () => {
        return client.send(new ListTablesCommand({}))
            .then(result => {
                console.log(`List Tables resolved: ${result.TableNames}`)
                return true;
            }, error => {
                console.log(`List Tables rejected: ${error}`)
                return false;
            })
    }

    let result = await waitUntil(waitCondition);
    console.log(result);

    let endTime = new Date().getTime();

    console.log(`Container created and db command executed in %d ms:`, endTime-startTime);

    return container;
}


async function waitUntil(predicate : () => Promise<boolean>){

    return new Promise(async (resolve, reject) : Promise<void> => {
        let timeElapsed = 0;

        while(!(await predicate())){
            await new Promise(r => setTimeout(r, 10));
            timeElapsed += 10;
            if(timeElapsed > 5000){
                reject("Timed out waiting")
            }
        }
        resolve(`Finished waiting successfully in ${timeElapsed}`);
    })
}