const { App } = require('@slack/bolt');
const axios = require('axios')
require('dotenv').config();

// Initializes your app with
// your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});


// Listen to the app_home_opened event, and when received, respond with a message including the user being messaged
app.event('app_home_opened', ({ event, say, client }) => {
  if(event.tab == 'messages'){
    say(`Hello <@${event.user}>!`)
  }else if(event.tab == 'home'){
    client.views.publish({"user_id": event.user,
    "view" : {
         "type":"home",
         "blocks":[
            {
               "type":"section",
               "text":{
                  "type":"mrkdwn",
                  "text":"Howdy!\n\nAsk me about *weather* with */weather*. \n\n Ask me about birthdays by messaging *birthday* in #birthdays channel. \n\n Interact with messages using shortcut *Ask me* ."
               }
            }
         ]
      }
    });
  }
    
});

app.message(/^[h,H]ello.*/, ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  say(`Howdy <@${message.user}>!`)
});

app.message('birthday', async ({ message, say }) => {
  console.log(message.channel)
  if(message.channel == process.env.SLACK_BIRTHDAYS_CHANNEL){
    // say() sends a message to the channel where the event was triggered
    say(`Hey there <@${message.user}>! Birthday Request received!`)
    await requestBirthday()
  }
});

// A slash command that shows an ephemeral message
app.command('/weather', async ({ command, context, ack }) => {
  ack()
  app.client.chat.postEphemeral({
    token: context.botToken,
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: 'section',
        block_id: 'block1',
        text: {
          type: 'mrkdwn',
          text: 'Which city would you like a weather report for? :sunny::snowman_without_snow::umbrella:'
        },
        accessory: {
          type: 'external_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select an item'
          },
          action_id: 'choose_city',
          min_query_length: 3
        }
      }
    ]
  })
});

// responds with options
app.options({ action_id: 'choose_city' }, async ({ ack }) => {
  // Get information specific to a team or channel
  const results = [
    { label: 'New York City', value: 'NYC' },
    { label: 'London', value: 'LON' },
    { label: 'San Francisco', value: 'SF' }
  ]

  if (results) {
    const options = []

    // Collect information in options array to send in Slack ack response
    await results.forEach(result => {
      options.push({
        text: {
          type: 'plain_text',
          text: result.label
        },
        value: result.value
      })
    })
    console.log(options)
    ack({
      options
    })
  } else {
    ack()
  }
});

// prompt weather condition based on selection
app.action('choose_city', async ({ ack, say, action }) => {
  ack()
  const selectedCity = action.selected_option.value
  if (selectedCity === 'NYC') {
    say(`You selected the option ${action.selected_option.text.text} --> "It's 80 degrees right now in New York!`)
  }
  if (selectedCity === 'LON') {
    say(`You selected the option ${action.selected_option.text.text} --> "It's 60 degrees right now in London!`)
  }
  if (selectedCity === 'SF') {
    say(`You selected the option ${action.selected_option.text.text} --> "It's 70 degrees right now in San Francisco!`)
  }
});

// Listening for the 'mybirthday' block/date field we sent above...
app.action('mybirthday', async ({ action, ack, respond }) => {
  ack()
  var birthday = new Date(action.selected_date)
  var currentDate = new Date()
  var dayAge = Math.ceil(Math.abs(currentDate.getTime() - birthday.getTime()) / (1000 * 3600 * 24)).toString()
  console.log('Birthday Received : ' + birthday.toDateString())
  var respondText = "Wow, cool ... you're " + dayAge + ' days old!'
  respond({ text: respondText, delete_original: true })
});

// Custom unfurls
app.event('link_shared', async ({ event, context }) => {
  console.log('got a link share event')
  const unfurls = {}
  event.links.forEach(async (link) => {
    // let customText = `:wave: This is a custom unfurl of *url*=${link.url} *domain*=${link.domain}`;
    const unfurlBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a custom unfurl, made possible by calling the Slack `chat.unfurl` API'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Domain:*\n${link.domain}`
          },
          {
            type: 'mrkdwn',
            text: `*URL:*\n${link.url}`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Was this unfurl helpful?'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Yes :100: '
            },
            style: 'primary',
            value: 'yes_helpful'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Needs work :thumbsdown:'
            },
            style: 'danger',
            value: 'no_needs_work'
          }
        ]
      }
    ]
    unfurls[link.url] = { blocks: unfurlBlocks }
  })
  
  app.client.chat.unfurl({
    token: process.env.SLACK_BOT_TOKEN,
    channel: event.channel,
    ts: event.message_ts,
    unfurls: unfurls
  })
});


// Waiting for the dev message action to be called, which will retrieve a message link
// and post to the user who initiated's app home
app.shortcut(/^dev.*/, async ({ shortcut, ack, say, respond, context }) => {
  ack()

  try {
    const resultLink = await app.client.chat.getPermalink({
      token: context.botToken,
      channel: shortcut.channel.id,
      message_ts: shortcut.message_ts
    })

    var theMessage = `:wave: Hi there! remember when you thought you'd enjoy this interesting message ${resultLink.permalink}? Thank yourself for this!!`

    // Try block for second web api call to post link to the message
    try {
      await app.client.chat.postMessage({
        // The token you used to initialize your app is stored in the `context` object
        // Sending the channel id as the user will send to the user
        token: context.botToken,
        channel: shortcut.user.id,
        as_user: true,
        text: theMessage
      })
      console.log(`Remember request sent to ${shortcut.user.id}`)
    } catch (postMessageFailure) {
      console.error(postMessageFailure)
    }
  } catch (permaLinkFailure) {
    console.error(permaLinkFailure)
  }
});


(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️Hello.. app is running!')


})();


async function requestBirthday () {
  console.log('Begin birthday post to channel creator in: ' + process.env.SLACK_BIRTHDAYS_CHANNEL)

  try {
    var channelResult = await app.client.conversations.info({ token: process.env.SLACK_USER_TOKEN, channel: process.env.SLACK_BIRTHDAYS_CHANNEL })
    var channelCreator = channelResult.channel.creator

    try {
      app.client.chat.postEphemeral({
        token: process.env.SLACK_USER_TOKEN,
        channel: process.env.SLACK_BIRTHDAYS_CHANNEL,
        user: channelCreator,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Hi, When is your birthday?'
            },
            accessory: {
              type: 'datepicker',
              action_id: 'mybirthday',
              initial_date: '1999-12-31',
              confirm: {
                title: {
                  type: 'plain_text',
                  text: 'Are you sure this is your birthday?'
                },
                confirm: {
                  type: 'plain_text',
                  text: 'Yep!'
                },
                deny: {
                  type: 'plain_text',
                  text: 'Sorry, my bad!'
                }
              },
              placeholder: {
                type: 'plain_text',
                text: 'Select a date'
              }
            }
          }
        ]
      })
    } catch (postMessageFailure) {
      console.error(postMessageFailure)
    }
  } catch (channelInfoError) {
    console.error('Channel error: ' + channelInfoError)
  }
}