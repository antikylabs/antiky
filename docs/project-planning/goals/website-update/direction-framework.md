I've been thinking about the framework and how we want to position it.

I've learned a lot about what we're doing here and why. Our thesis still holds, so I don't really want to touch a thesis page right now. I'll do a separate review of that. For a framework, I really want to help users understand what it is and why it's different. 

The problem I see with engines and frameworks today is they're still being built with the end user being the human, and so it's always built in that direction first versus AI being the first user. 

And so there's a couple of things that we've made decisions about in the framework that change things. One is that the framework is AI-native from day one. 

The language it's written in is specifically chosen because of the amount of training models have towards TypeScript, the alignment with the DOM and GPU and web GPU that TypeScript has, and the inherent closeness JavaScript and Canvas and everything have together. Works really well. 

Combine that with a rendering library that compiles web GPU shaders using a TypeScript domain-specific language or DSL. It's really powerful. The rendering framework is also ahead-of-time compiling. That's very important. We don't want to wait for shaders to compile during runtime. We don't want back and forth between CPU and GPU. We want to know up front what's going to the GPU and what's staying on CPU. 

This limits back-and-forth cross-talk, how many writes we are doing per frame, and stuff. We can isolate: does logic need to happen within the simulation step on the CPU? Does it need it? Can it happen in the simulation step on the GPU, etc.? 

Tie that with a very strong component model and system and a way to tag all entities. A strong event sourcing system so that we have a durable record of truth that agents can do simulations and stuff against. It's very powerful. 

MCP is not an afterthought in this. The agent has two ways it can interact with the framework:
- It can write code directly using the framework itself.
- It can write shaders directly using Bro Metal.
- It can bridge the logic and write custom things it needs in TypeScript that's outside of the framework's capability today.
The other way it can interact is through the MCP. MCP is mostly for launching and controlling and interacting with the game in session state as it's doing development, so that it can iterate and work on the game, play the game, inspect the game, observe the game, et cetera. 

This inherently changes what our studio looks like because our studio becomes more of an inspection point than an authoring point. The studio is the human gateway for what the agent is doing and how to operate, control, and manage the agent and build. 

Eventually, there will be more human control, but the main human control is to look and observe in the studio and then tell the agent what to do with the framework in MCP. 

We're building this fully open source so anybody can benefit. Anybody can learn from what we're doing. We may not be the most performant right now, but we definitely are going to be the most AI native, I think.
