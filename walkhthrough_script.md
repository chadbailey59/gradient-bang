I've been playing Gradient Bang since it was released, and honestly, before it was released, too, because I'm part of the team that builds it. I’m making a whole series of "let's play" videos that I'll link to in the description where you can see what I've been up to. But I want to take a few minutes to talk you through the code, show you how it works, and why "AI Native" is really a different way of thinking about making apps. I'll use chapters so you can skip what you already know.

We’re going to cover a lot of things across a few different videos. like Voice AI architecture basics, subagents, injecting world events into the LLM context, dynamic UI control and generation, and a lot more.

First of all: The high level stuff. Gradient Bang is built with Pipecat, the open source framework for voice and multimodal agents, but also, pretty much the only way to build multi-agent orchestration. I'll show you that in a minute. First, the more general "multimodal agent" stuff.

All of the world data, the MMORPG part, the traditional game stuff, lives in a big Postgres database on Supabase. In lieu of a traditional REST API, we have a bunch of edge functions. So for example, to buy 10 units of quantum foam, something calls the "trade" edge function with the action, buy or sell, the commodity, the amount, and the player id. To move a ship from one sector to the next sector, something calls the "move" function with a player ID and the desired sector. This is all very straightforward, typical CRUD app stuff.

So what's the "something" that calls those APIs? It's a Pipecat botfile. Let me give you a quick rundown of how Pipecat works here.

A Pipecat bot is a python file that's running an asyncio loop with something we call a Pipeline in it. A pipeline is a set of processors connected to each other. The typical pipeline for a voice bot has a speech-to-text processor to transcribe what the user is saying, then an LLM processor to send the user's speech to an LLM, and then a text-to-speech processor to turn the LLM's response into text.

Pipecat uses this idea of "frames" to move data through this pipeline in small pieces to minimize the overall latency of information through the pipeline. Think, like "20 milliseconds of user spoken audio" or "a single token from the LLM". Frames stay in order, but they're all moving through these processors asynchronously kind of at the same time. There's a lot more info about frames themselves in the pipecat docs, but it's actually not the focus of what we're talking about right now. I'll link that below if you want to go down that rabbit hole.

I left off one more important Pipecat concept from the diagram a second ago. The STT processor needs to get that user audio from somewhere, and the TTS processor needs to send the bot audio _to_ somewhere. That "somewhere" is called the transport. It's an important piece of the Pipecat architecture that essentially connects the bot to "the real world". In order for this bot to feel good, to feel interactive, it's important for the transport to move media between the bot and the user as reliably as possible, and with as little latency as possible.

Pipecat supports a bunch of different transports. If you're building a voice bot that will only ever talk to one person on the phone, you can use the websocket transport, connect it to a Twilio websocket, and you're good to go. But if you're building anything with any complexity, and _especially_ if your user is in a web browser, you'll want to use a WebRTC transport. We'll come back to the transport later.

The last big architectural piece is the frontend. That's the React app at game.gradient-bang.com, where you've been playing. This app uses the Pipecat react client library to talk to the bot. We’ll talk more about this in a future video.

The Pipecat bot itself is hosted on Pipecat Cloud. Of course, Pipecat itself is completely open source, and it runs anywhere you can run Python code. We built Pipecat Cloud because it’s the platform we wanted. It makes it easy to deploy Pipecat bots and autoscale based on usage. It runs in a variety of geographic regions, and it has observability and all kinds of other good things already wired up.

But enough about that, back to Gradient Bang. when you sign in and click your character name, the client app makes a POST request to the gradient-bang bot on Pipecat Cloud, and asks it to start a new session. Pipecat Cloud starts an instance of the bot and tells it how to connect to the transport. Pipecat Cloud includes that same transport information in the response to the client's POST request, and the client connects to that transport.

In this case, we're using the Daily WebRTC transport. So when I jump into gradient bang, the client asks Pipecat Cloud to start a bot session. Pipecat Cloud creates a new Daily room, starts the bot, and gives us both the same Daily room. So by the time the client connects to that room, the bot is already there, ready to send and receive audio, video, text, or whatever through that transport. The client and the bot both stay connected to that transport for as long as you're in there playing. When you leave or close the window, the bot sees that you've disconnected, so it disconnects, and then Pipecat Cloud sees that the bot finished running, and ends that session.

Now I want to call out one more thing that's important "standard pipecat" behavior before we move on. A voice bot that just talks to you and tells jokes or whatever was cool a year and a half ago. Nowadays, we expect our voice bots to actually _do_ things. Now, the way _any_ LLM, including the one in a Pipecat pipeline, _does_ things is called tool calling, or, function calling. You'll hear me use those terms interchangeably.

If you've ever written code to talk to an LLM, you know that in addition to the conversation history, you have to include something called a "system prompt". This is how you guide the LLM toward how you want it to respond. So say you're building a demo, text or voice, you might use a system prompt like "You are a virtual assistant. Respond to the user in a helpful and friendly way." Then if the user says "hello?", the bot will say something like "Good morning! How can I help you?" But if your system prompt is "Talk like an angry pirate", the user says "Hello?" and the bot says "arr matey, leave me be!"

The system prompt and the conversation history together make up the context that's sent to the LLM anytime you want to generate a response. The system prompt sort of sits alongside the flow of the conversation as information that's available to the model but isn't part of the conversation itself.

Well, there's one more thing you can put in the context: tool definitions. The classic example is getting the weather. LLMs are trained on terabytes of historical data, but they don't know anything about the current state of the world. And nowadays, LLMs are "smart enough" to know what they don't know.

When you add tool definitions into the context passed to an LLM, you're telling the LLM that it can ask YOU, the developer calling the LLM, to give it information so it can properly respond to the user.

Imagine you as the developer sitting in a room and filming an interview between the LLM and the user of the app. The user says "should I wear a jacket today?" Without tool calls, the LLM just looks back at the user and says "I don't know... do you like jackets?"

But now imagine you've included a tool called "get current weather" in the context you gave to the LLM. Now, when the user says "should I wear a jacket today?" The LLM looks at its notes and goes "ooh," and turns to you and says "hey, what's the current weather today?" YOU look at your phone and say "ugh, 40 degrees and drizzling." Then the LLM turns BACK to the user and says "it's pretty gross outside today. A raincoat would probably be a good idea."

Tool calls kind of started as a way to give the LLM information it needs, but nowadays, they're used for way more than that. You can give the LLM a tool called "send email", and when it thinks it's appropriate in the conversation, based on the system prompt, it will ask you, the developer, to send an email. Now, it's up to you to actually write code that sends email when the LLM asks you to. But you'll see pretty quickly how this mechanism powers so much of gradient bang, and many other things that voice bots do.

So far, we have a pretty standard Pipecat voice bot setup: A cascading pipeline, which is what we call STT-LLM-TTS, with some function calling. But Gradient Bang does plenty of advanced pipecat stuff. Let's look at the botfile again.

One thing I haven't mentioned yet is how the bot sends structured data to the client. Audio goes through the transport, right, that WebRTC connection. But we also need to send things like game events, UI state, player data, all kinds of stuff that isn't audio. For that, we use this thing called RTVI, which is a standard that the client and bot can use to push JSON to each other. Those JSON messages go through the transport just like the audio does. If a bot pushes an RTVI message to the client, it goes out of the transport output. If the client pushes a message, the bot sees it come in through the transport intput. It's like a sidecar data channel. So in addition to the audio back and forth, the bot is pushing tons of update events to the client, and the client is sending things like button pushes to the bot.

Now here's where it gets a little bit fancy. Look at the pipeline in the botfile. You see our standard cascade: STT, LLM, TTS. But there's this second branch running in parallel. This is the UIAgent.

The UIAgent is a completely separate LLM, running its own inference, with its own context and its own set of tools. It sits in this thing in Pipecat called a ParallelPipeline, which means it receives the same input frames as the voice branch, but it processes them independently. Every time you say something to the bot, the voice branch does its thing, generates a spoken response, calls game tools, whatever. But at the same time, the UIAgent sees that you spoke, and it runs its own inference to figure out what the UI should be doing.

So say you ask the bot "where's the nearest port selling quantum foam?" The voice agent is going to look that up and tell you. Meanwhile, the UIAgent, totally on its own, decides "oh, the player is asking about ports, I should pull up the map and zoom to that area." It has tools like "control UI" that let it show or hide panels, center the map on a sector, zoom in, highlight a route. And it sends all of those commands to the client through RTVI messages.

This is our first taste of "AI Native development." There is no logic anywhere in the code that says "when the user asks about ports, show the map." The UIAgent has its own system prompt that describes the game's UI and what the different panels are for, and it uses that to make its own decisions about what to show you. It's a separate AI making UI decisions in parallel with the AI that's talking to you. And because it's running on a faster, lighter model, it usually does what it wants even before the voice response even starts playing.

But even that is still kind of... standard Pipecat. This is where we move into the real "AI Native" development stuff.

So everything I've shown you so far, the voice pipeline, the UIAgent, the function calling, that's all happening while you're actively talking to the bot. It's reactive. You say something, the bot responds. But there's a lot of stuff in Gradient Bang that takes a really long time and multiple steps to do. And there's this whole thing with "corporation ships" that can act somewhat autonomously. you can tell your ship or a corp ship to go do something, and it will go do it on its own, even if you stop talking.

— Subagents version —

That's the TaskAgent, and this is where things get really different.

We're going to need a whole new module called Pipecat Subagents for this.

The idea behind Pipecat Subagents is that one pipeline isn't enough. When you have a single pipeline, everything lives in one LLM context, one set of tools, one conversation. That works great for a simple voice bot. But what if you need multiple LLMs doing different things at the same time?

Pipecat Subagents makes it a lot easier to run a bunch of specialized agents with their own LLM contexts and tools, but they’re also sharing information between them. 

The most important thing that subagents does is separate tasks. In an app like Gradient Bang, you need a voice agent that never blocks, that can always respond to user input. Then you can have other agents do long-running work. 

So architecturally, you have this shared message bus. It’s  It creates a shared message bus, kind of like an internal event system, and it manages the lifecycle of all the subagents in the system. Every subagent gets its own pipeline. Its own LLM, its own tools, its own context. They're completely independent agents that just share the bus.

There are a few agent classes already defined in the Subagents module. There's BaseAgent, which is a base class that manages its own pipeline and lifecycle. If you're building with Subagents, you almost always want to start by subclassing BaseAgent. There's also LLMAgent, which extends BaseAgent and gives you an integrated LLM with tool calling handled for you. 

The bus is how all these agents talk to each other. An agent can broadcast a message to everyone, or send a targeted message to a specific agent by name. The messages themselves are just Pipecat frames, so they can be data, or control frames, or whatever.

In Gradient Bang, there's a main agent that owns the transport. All the stuff I showed you before with the main voice pipeline _and_ the UI agent is wrapped up in a class called VoiceAgent. There's one of those.

— Newer Pipecat Version —

This is where some brand new Pipecat functionality comes in.

See, up until now, we’ve always shown this picture when we explain Pipecat. We talk about the pipeline, and how it connects to the transport, and frames flow through the pipeline, and here’s your LLM, and so on. This is all still true.

But recently we added some classes in Pipecat that let you break this part out into an arbitrary collection of tasks. All of these tasks are connected to a bus, a bridge, where they can talk to each other, and you can dynamically add and remove tasks and all sorts of things.

Remember the ParallelPipeline from the UIAgent part? This is that taken to the next level.

So Gradient Bang can have a VoiceAgent task that is the ship UI you know and love. Its job is to stay responsive to you, the player, when you talk to it. So if you ask it to something complicated that will take a long time, it can just spin up a task over here that runs in parallel to do that thing, and both of these tasks can communicate with each other over this bus.

This is the foundation that makes the rest of what I'm about to show you possible.

When you say something like "go to sector 47 and fill up the holds with neuro symbolics," the VoiceAgent's LLM decides that this is a task. It calls a tool called "start task" with a text description of what you want done. Pipecat Subagents spins up a brand new TaskAgent and connects it to the bus. Then the VoiceAgent hands it the task description and says "go."

The TaskAgent has a whole bunch of tools. I think we're well over 30 now. Most of them map to an edge function on Supabase. Things like "move to sector", or "plot course", or "trade". It's a big list, but it's really only the things where we need to use the server to enforce rules. We don't want you to be able to prompt engineer your way to infinite free quantum foam.

But it's the TaskAgent LLM's job to look at all the tools it has, look at whatever you asked it to do, and figure out how to make it happen. So if you say "go run a profitable trade loop a few times, then head to a megaport to refuel and drop the proceeds in the bank," there's no algorithm somewhere in the gradient bang source code that tells the TaskAgent how to do all that. An LLM just... figures it all out.

And it's actually even more complicated than that! Because this is a MMORPG, the world is constantly changing, and pretty much all of the tool calls are asynchronous. When the LLM calls "move," it doesn't just get back "ok, you moved." The tool returns immediately with "executed," and then the agent _waits_. It waits for the actual game server to process the movement and fire a real "movement complete" event. That event comes back through the game's event system, lands in the TaskAgent's context, and _then_ the LLM wakes back up, sees the result, and decides what to do next. So the agent is always reasoning about actual game state, never guessing.

This loop of think, act, wait for the world to respond, think again, that's the core of what we mean by AI Native. The LLM _is_ the control flow. There's no state machine in the code that says "first move, then trade, then move again." The LLM figures that out. And because every event goes into its context, by step 30, the LLM has a full history of everything that's happened during this task. If something unexpected happens, like someone attacks the ship mid-route, that combat event shows up in context, and the LLM can adapt. Maybe it fights back, maybe it runs, maybe it changes the plan entirely. That's not algorithmic. That's the model reasoning.

And it gets even crazier when you have a corporation with multiple ships. Each ship can have its own TaskAgent running simultaneously, each with its own LLM context, each making independent decisions, each reacting to their own events. You can tell one ship to go trade and another to go explore, and they'll both just... do it. In parallel. Autonomously.

You can even steer a task while it's running. If you say "actually, stop at sector 20 first," the VoiceAgent injects that new instruction directly into the TaskAgent's live context, and the LLM re-plans on the fly. It's like typing to Claude Code while it's working.

When a task finishes, the TaskAgent sends the result back to the VoiceAgent. It waits for a break in the conversation, and then tells you what happened. "Hey, your corp ship just finished up. Did 3 runs swapping quantum foam and put 450 credits in the bank. It's topped off with warp fuel and ready to go." And you didn't micromanage any of that.

This is what we mean by AI Native. The game isn't using AI as a feature. The AI _is_ the game. Every decision, every action, every reaction is an LLM reasoning about the world and deciding what to do next. The code provides the tools and the event infrastructure. The intelligence, and dare I say the FUN, comes from the model.

—

Need another video for the frontend!

Subagents is the 200 level stuff. Mark’s also doing dynamic UI stuff

