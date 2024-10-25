# Alexa Custom Notify with actionable notification

The aim of this project is to avoid the use of Alexa Media Player custom component for tts/announce. It also provide a support for actionable notification.

This project does not replace at all AMP since it does not provide media_player functionalities like audio file play, custom commands like skill invocation, volume adjustment and so on.

**This project is not for beginners.**

Let's assume:
- you know what is the Amazon Developer Console
- you know how to create Skill in Amazon Developer Console
- you know what are Home Assistant Areas
- you know what are Home Assistant Tokens
- you know how to create helpers and mqtt sensor in Home Assistant
- you know what is MQTT and it's already configured within your Home Assistant
- your Home Assistant is exposed on public internet with https connection
- your Home Assistant is _exposed_ to Alexa via Nabu Casa or HAASKA
- you know how Home Assistant entities are exposed to Alexa (we need to use them as routine trigger)

**If any of the above assumptions are not verified, delve deeper into that topic(s) and come back when they are clear and confirmed.**

## Check list
1. Create Alexa Skill
2. Create HomeAssistan entities/scripts
3. Create Alexa Routine(s)
4. Test
 
## Let's start.

### Create Alexa Skill
Create the skill from Alexa Developer Console. Give it the name you want.

#### Skill Configuration Values

- Type: **other**
- Model: **custom**
- Hosted: **node.js**
- Template: **scratch**
- Invocation Name: **custom tts** (please, keep in mind this value)

At this point save the Skill and then copy the content of ```interaction_model.json``` into the JSON Editor.
Save the Skill and build it.

Once built, go to ```code``` section and replace the content of the ```index.js``` and ```package.json``` files.

Please remember to change ```ha_url``` and ```ha_token``` constants value inside ```index.js```.


Click save and deploy: once deployed, go to test and enable the deveopment stage.


### Create HomeAssistan entities/scripts
In Home Assistant create an ```input_boolean``` helper for each echo device you want to use: ```input_boolean.alexa_tts_**<echo_name>**```

***At this point you should expose these entities to Alexa through your provider (Nabu or Haaska).***

_Suggestion: assign each entity to related area._


Now you can create an mqtt sensor like this:
```
mqtt:
  - sensor:
      - name: "alexa_tts_data"
        unique_id: alexa_tts_data
        state_topic: "alexa_tts/data"
        value_template: "{{ value_json.state }}"
        json_attributes_topic: "alexa_tts/data"
        json_attributes_template: "{{ value_json.info | tojson }}"
```



And finally, you can create the script:


```
alias: alexa_tts_launch
sequence:
  - action: input_boolean.turn_off
    metadata: {}
    data: {}
    target:
      entity_id: input_boolean.alexa_tts_{{alexa_device}}
  - action: mqtt.publish
    metadata: {}
    data:
      evaluate_payload: false
      qos: 0
      topic: alexa_tts/data
      payload: |-
        {
            "state": "call",
            "info": {
                "event_id": "{{context.id}}",
                "need_answer": "{{need_answer|lower}}",
                "suppress_confirmation": "{{suppress_confirmation|lower}}",
                "speak_out": "{{text}}"
            }
        }
  - action: input_boolean.turn_on
    metadata: {}
    data: {}
    target:
      entity_id: input_boolean.alexa_tts_{{alexa_device}}
  - if:
      - condition: template
        value_template: "{{need_answer == True}}"
    then:
      - wait_for_trigger:
          - trigger: state
            entity_id:
              - sensor.alexa_tts_data
            to: answer
            from: call
        enabled: true
        timeout:
          hours: 0
          minutes: 0
          seconds: 15
          milliseconds: 0
      - if:
          - condition: template
            value_template: "{{ wait.trigger == None }}"
        then:
          - action: mqtt.publish
            metadata: {}
            data:
              evaluate_payload: false
              qos: 0
              topic: alexa_tts/data
              payload: |-
                {
                    "state": "answer",
                    "info": {
                        "event_id": "{{context.id}}",
                        "need_answer": "{{need_answer|lower}}",
                        "suppress_confirmation": "{{suppress_confirmation|lower}}",
                        "speak_out": "{{text}}",
                        "answer": "ResponseNone"
                    }
                }
    enabled: true
  - variables:
      response:
        intent: "{{state_attr('sensor.alexa_tts_data', 'answer')}}"
  - stop: recognized
    response_variable: response
fields:
  alexa_device:
    selector:
      text: null
    name: Alexa Device
    required: true
  text:
    selector:
      text: null
    name: Text
    required: true
  need_answer:
    selector:
      boolean: {}
    name: Need Answer
    required: true
  suppress_confirmation:
    selector:
      boolean: {}
    name: Suppress Confirmation
    required: true
description: ""
mode: single
```

### Create Alexa Routine(s)
The final step is to create Alexa routine(s) based on ```input_boolean``` activation.
To do this:
1. Open Alexa app on your smartphone with the same account used for Skill Creation
2. Create a routine with:
   - trigger: the opening of your entity
   - action: custom command like "_Alexa, open **custom tts**_" - replace **custom tts** with the skill invocation name, if changed.
3. Repeat 1. and 2. for each entity/echo device you want to involve.

### Test
This is an example of usage without actionable notification:
```
action: script.alexa_tts_launch
data:
  need_answer: false
  suppress_confirmation: false
  alexa_device: show
  text: hello world!
```

This is an example of usage with actionable notification:
```
action: script.alexa_tts_launch
data:
  need_answer: true
  suppress_confirmation: false
  alexa_device: show
  text: Are you Ok?
```

This will produce an output variable: ```intent: ResponseYes```, for example.

You can use it in automations/scripts like this:
```
alias: test_alexa_answer
sequence:
  - action: script.alexa_tts_launch
    data:
      need_answer: true
      suppress_confirmation: false
      alexa_device: show
      text: vuoi accendere la luce?
    response_variable: response
  - if:
      - condition: template
        value_template: "{{response.intent == 'ResponseYes'}}"
    then:
      - action: light.turn_on
        target:
          entity_id: light.faretti
description: ""
```
