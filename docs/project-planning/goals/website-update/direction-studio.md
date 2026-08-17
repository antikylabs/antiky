Alright, so I've been thinking about the studio as well. 

The studio is a canvas on it to itself. The canvas changes, and we call this mini apps or extensions or plug-ins, but our term is going to be mini apps to reflect the situation that the user needs at that time. 

The Studio is mostly for human interaction with the framework, engine system, games, et cetera. More importantly, it's the primary interaction point that humans can use to orchestrate and control the agents for game native development, for AI native game development. 

This means there's not a lot of properties, panels, and stuff for you to be controlling or interacting with, etc. Right now, most of this is read-only to the end user. If you want to go change that, you have to go find it in the code and change it. 

But that's fine for agents. You can look at properties and observations and tell the agent what to do. We also want a strong feedback system and loop here. We're looking to integrate ACP (agent client protocol) into the studio so that it can connect natively to your coding agents that you use every day. 

Right now, we don't want to build our own coding agent. We want to build on top of coding agents that already exist. 

But interactions and many points within our system should allow you to send data to that ACP to instruct the agent and give it context in addition to your instructions and feedback. 

So, for example, you may click on an object in a web scene and put some instructions on how to change or update or move or build around that object. 

You may take a screenshot of the whole game or a section of the game and tag that image with some comments or feedback. 


You may select an event in the event log and want to give feedback directly about that event. 

You may select a project property in the inspection and give some feedback around that. Basically, anything that you can touch, read, see, or interact with in the studio, we want to be able to capture that information at that point and tag that along with the context and instructions and direction you want to give the agent. 

So it really becomes a canvas of its own to interact and work with the agents that you are controlling. 

For the ACP, I really like Zed editor and how they do that ACP stuff, where you can bring in your own various different ACP-compatible agents. You can also just start a terminal agent, which gives you a terminal, and then you can do stuff.

I think the ACP side is really neat because you can manage the rich objects and stuff you can inject into the prompt you're sending to the agent. You can control that outside of the terminal, so that's going to be our primary focus. The terminal will be allowed to be a tab that you can open up inside the agent panel just to do terminal-based things and other interactions you want to do. 

This concept of a completely interactive studio: every piece is a feedback knob to the agent, a strong ACP system for interacting with agents and the mini app system so that it can grow and become what a user needs it to be.

That means that, for our mini app, there are some very specific architecture decisions that we need to make around what we expose to allow many apps to hook in. A mini app should be able to allow its interface to be hooked in for giving feedback, etc., just like the main studio. We have to think about not only the hooks for typical plug-in stuff for the many apps to expand the studio, but also how a mini app hooks into the sending context to the ACP from the user, etc. 

The other thing is we may want to queue up a bunch of feedback pieces and bundle them all together into one prompt to send. There might need to be some type of feedback staging panel or whatever that's globally available. The item plus the feedback is staged into that, and then all of that is compiled into the ACP window based on the items selected that the user wants to do. Maybe they can give an additional message with that group of items of feedback or whatever. Some type of global feedback hold queue system and storing that within a project is needed. 

And I know our studio also needs things like asset browser and stuff like that. We'll get to that. I would expect those to essentially be many apps that we can add in the future.
