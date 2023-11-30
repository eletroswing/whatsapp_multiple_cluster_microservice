# CLUSTERED INSTANCES FOR WHATSAPP WEB JS
## What It Does
Creates an Event Driven Architecture (EDA) based on redis and rabbitmq with the aim of managing multiple sessions in whatsapp web js.

Sessions are currently saved with local auth due to a bug in the WhatsApp web js remote store.

You can have as many clusters as you want, including automatically scaling them, it works to actually work with multiple instances and multiple machines in production.

## How to run

Before all: Rename the .env.example to .env.

First install all the packages:
```
    npm install
```

Then init the docker services. 
```
    cd infra
    docker-compose -f docker-compose.development.yml up -d
```

Finally, come back to the root directory and run:

Start: ```npm run start```
Dev: ```npm run dev```

## All the events
You can have as many connected clusters as you want, it automatically detects the key and sends it to the correct instance

### Manage instances
create_instance:   recive a json containing a unique key
destroy_instance:  recive a json containing a unique key to destroy
send_message:      recive a json containing a unique key to send the message, an chat_id in format @c.us, and a message text.

### From the instance
authenticated_instance: a instances get authenticated: receive a body containing the key
disconnected_instance: a instances get disconnected: receive a body containing the key
auth_failure_instance: a instances get an auth_failure: receive a body containing the key
message_instance: a instances get an message: receive a body containing the key and a message containing the message from wwebjs

## Limits
The cluster stops accepting the creation of new connections when 'exceeding' the machine's resources:
ram: 90% 
OR
CPU: 90%

And receive creation again from:
RAM: < 80%
E
CPU: < 80%

## How to get the qr code
They are on redis with the key `instances:{key}:qr_code`.

## Rabbit Mq pannel
The rabbit mq pannel from docker should be avaible on http://localhost:15672

# This microservice is in no way affiliated with WhatsApp and WhatsApp WebJS, we just use their services to connect them.