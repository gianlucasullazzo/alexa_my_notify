/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const ha_url = "https://<YOUR URL HERE>";//no slash
const ha_token = "Bearer <YOUR TOKEN HERE>";
const sensor = "sensor.alexa_tts_data";
const topic = "alexa_tts/data";

const axios = require('axios');
const Alexa = require('ask-sdk-core');
const {
  getRequestType,
  getSlotValue,
  getIntentName,
} = require('ask-sdk-core');

var event_id;

const HandlerHelper = {
    async handleResponse(responseBuilder, responseType) {

        await HomeAssistant.update(responseType);

        var response = responseBuilder
            .speak(HomeAssistant.confirmation())
            .withShouldEndSession(true)
            .getResponse();
            
        return response;
    }
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        
        await HomeAssistant.init();
        
        //used for show device workaround
        event_id = HomeAssistant.event_id;

        var response =  handlerInput.responseBuilder
            .speak(HomeAssistant.speak_out)
            .withShouldEndSession(!HomeAssistant.need_answer)
            .getResponse();
        
        return response;
    }
};

const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseYes');
    }
};


const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    async handle(handlerInput) {
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseNo');
    }
};

const HandleItemIntentHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && getIntentName(handlerInput.requestEnvelope) === 'HandleItemIntent';
    },
    async handle(handlerInput) {
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, getSlotValue(handlerInput.requestEnvelope, 'Item'));
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    async handle(handlerInput) {
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseNo');
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak("")
            .getResponse();
    }
};

/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    async handle(handlerInput) {
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseNone');
    }
};

/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    async handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        await HomeAssistant.init();
        if (event_id === HomeAssistant.event_id) {
            return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseNone');
        }
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};

/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    async handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);
        return await HandlerHelper.handleResponse(handlerInput.responseBuilder, 'ResponseError');
    }
};

const HomeAssistant = {

    async init() {
        var sensor_state = await axios.get(ha_url + '/api/states/' + sensor,
        {
            headers: 
            {
                "Authorization": ha_token
            }
        });
        
        this.state =  sensor_state.data.state;
        this.event_id = sensor_state.data.attributes["event_id"];
        this.need_answer = sensor_state.data.attributes["need_answer"] === 'true';
        this.suppress_confirmation = sensor_state.data.attributes["suppress_confirmation"] === 'true';
        this.speak_out = sensor_state.data.attributes["speak_out"];
    },
    
    async update(a) {
        await this.init();
        if (this.need_answer) {
            this.state = "answer";
            await axios.post(ha_url + '/api/services/mqtt/publish',
            {
                "topic": topic,
                "payload": "{\"state\":\"" + this.state + "\",\r\n\"info\": {\r\n\"id\": \"" + this.event_id + "\",\r\n\"need_answer\": \"" + this.need_answer + "\", \r\n\"speak_out\": \"" + this.speak_out + "\", \r\n\"answer\": \"" + a + "\"}}"
            },
            {
                headers: 
                {
                    "Authorization": ha_token
                }
            });
        }
    },
    
    confirmation(){
        if (this.need_answer && !this.suppress_confirmation) {
            return "OKAY";
        }
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        YesIntentHandler,
        NoIntentHandler,
        HandleItemIntentHandler,
        CancelAndStopIntentHandler,
        HelpIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();
