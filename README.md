#Flow Ambassador

is a JS flow engine built on Node ( middleware provided ).  The nominal use case is to support web applications so the
middleware that is provided is built on Express.

#####  Impetus
  I started this project to create a javascript flow engine and to support a technology transformation in which you
  could move to Node in your server stack.  The specification was to cause minimal changes in
  existing web applications that were built on the JEE stack, in particular Spring Webflow. As a new convert to
  javascript and functional programming, I wanted to embrace javascript and Node while perserving the core of Spring
  Webflow's behavior and specification.  I want to give Spring Webflow much credit for providing such a mature product
  and great documentation for me to start from.

#####  There were specific considerations in the flow engine design such as:

- Ability to be client-driven via the client's current state and a requested event.
- Capitalize on the dynamic nature of the javascript language by allowing the flow author to register their functions
for state entry, exit, and error handling.
- Flow definition and flow implementation separated into different files so that configuration can be separate from the
javascript biz logic functions
- Support asynchronous nature of javascript by driving asynchronous behavior as default
- The ability to deploy the engine in a cluster and having each request/response cycle for a specific flow instance
being handled by different flow engine instance in the cluster.
- The ability to redirect out of the flow engine for degradation ( once you leave you can't return since your session
data will be cleared from cache/persistence storage ... see express for session management ).

#####  Similarities and Differences with Spring Webflow
  For those familiar with Spring Webflow, I'd like to list some of the key similarities and difference to accelerate
  your ramp up.

######  Similiarities:
  - View, Action, and End states
  - Declarative state transitions
  - Subflow support
  - Flow level security model (role based)
  - A flow abstraction to model "long conversations" in web applications
  - On entry for and on exit semantics for view states
  - On entry semantics for action states
  - Definitive start state and end states
  - Global Transitions
  - Flow execution id to determine flow instance and current state
  - Event id to determine the event to process
  - Ability to register flow event listener


######  Differences:
  - All authored functions in Flow Ambssador are async
  - NO decision states in Flow Ambssador
  - Middleware is built on Express.js with Connect architecture vs Spring's Request Dispatcher built on the servlet
  - Redirect functionality is built-in with flow instance rollup/completion in the Flow Ambassador
  - Flow Ambassador provides a comprehensive state history for each flow instance
  - Conversational state management is the responsibility of the flow author using the Express session
  - Application writer is responsible for handling (render) error scenarios and is advised to handle all rendering even
  though the middleware can do it ( mainly useful for testing the engine and for rapid prototyping).

###### Similiar but Different
  - Error handlers but Flow Ambassdor enforces a per state error handler that the flow author registers


##### Express your flow using the following example schemas:

Flow definition files:

[Parent flow](test/xoflowDefinition.js) 

[Subflow](test/changeShippingAddressDefintion.js)

[Subflow of Subflow](test/fakeSubflow2Test2LevelsDeepDef.js)

Required fields: flow name, start state, an endState(s) and at least on action or view state.

Optional fields: global transtions, security roles

Flow implementation file:

[Parent flow](test/xoflow.js)

[Subflow](test/changeShippingAddressFlow.js)

[Subflow of Subflow](test/fakeSubflow2Test2LevelsDeepFlow.js)

Required fields: Flow definition reference, an endState(s) and at least on action or view state.

Optional fields: subflows and authorizationDelegate


##### State Management:
Client applications may choose to manage history by storing state and transitions to previous states without calling the
server, so the ability to resolve client current state with the current server state before processing client requests
is a key feature of this framework.  This is accomplished by the client sending in the flowExecutionKey and _eventId
with each request.  The flowExecutionKey is the a flow instance unique id with a current state appended. The event id
maps to a requested state for the current state.

While the flow session is managed by the framework, you application state needs to be managed by the flow author. The
session is available and attach to context.request.session so that you may use it to save off your current application
state between each request/response.  Please note that the behavior of the session is decided by the session management
approach that is used with the Express middleware that the engine middleware is built upon.


##### States:
You must define a start_state and an end state(s) in your definition file:

```javascript
start_state: 'someFlowState',
endStates: [ 'done', 'quit', 'redirectedOut' ]
```

Transitions from view states, will be based on the event provided by user input ....  using the "_event" from the
request parameter. In case of an action state, the executed onEntry() will return the event to determine
the transition. For subflow states, the subflow end state will be used as an event to determine the next transition
to be excuted in the parent flow.  Clients should *ONLY* be requesting an event from a VIEW state.

Action states will continue to be executed until a view state is reached.
All states, *except end states*, need a type, onEntry function and error function defined.
End states, while states, do not execute any user defined functions and do not have to have any declaration or
definition other than:

```javascript
endStates: [ 'done', 'quit', 'redirectedOut' ]
```

View states MUST have a view name defined, although you can over-ride by setting the value of context.flow.viewName that
is passed into your state's function(s).
Subflow state names can differ from the subflow names but the subflow state MUST include a 'flowName' property that MUST
be the exact flow name in the subflow definition file:

```javascript
subflow: {
    changeShippingAddressSubflow: {
    // the subflow name MUST be the exact flow name in the subflow definition file
    flowName: 'changeShippingAddressFlow',
 ```

Subflow states MUST have at least one transition defined.


##### Transitions
A view state may contain either a state transition per event in the format of a string:

`eventName: 'myNextState'`

OR it can contain both a state transition per event AND a onExit method:

`eventName: { nextState: 'myNextState', onExit: 'myCoolMethod' }`

An action state only contains a state transition per event in the format of a string:

`eventName: 'myNextState'`

A subflow state contains an object per subflow with the transitions per event in the format of a string.  Each
transition event name correlates to an end state in the subflow and the next state can be a state in the parent
flow or an end state in the parent flow:
```javascript
subflowNameDefinedInSubflowDefintionFile: {
    flow: subflowDefinitionFileAsObject,
    transitions: {
        subflowEndStateEvent_1: 'nextStateName',
        subflowEndStateEvent_2: 'endStateName'
    }
}
```

Note: Both the onEntry, onExit( your custom function for a view state) , and error functions you register MUST use the
callback whether you are performing work asynchronously or synchronously in those functions:

##### A State's registered  onEntry() behaviour

`onEntry: function (context, callback) where callback(err, [transitionKey] )`


When 'err' is null, the 'transitionKey' in the callback only makes sense for an action state since a view state's
onEntry should just be preparing data for the view to render.

If 'err' exists, then transitionKey is ignored since the error function for the requested state will be called and will
dictate which state to transition to.

##### A State's registered onExit() behaviour (ONLY applicable for VIEW states)

`'yourViewStateExitMethod': (context, callback)  where callback(err)`

If 'err' exists then the state's registered error handler is called.
If 'err' is null then the configured nextState is used to transition to.

##### A State's registered error behaviour

`error(context, callback, statePhase) where callback(err, stateNameToTransitionTo)`

You can't render unless you are in a view state.  So you must handle errors by either staying in the current
view state, ultimately propagating to a view state, or using callback(err, null) so that next(err) rather
than render is called by the the flow engine middleware.

Your error handler will be passed the state phase, 'onEntry' or 'onExit', that the error occurred.

Provided that the error object is not null and the stateNameToTransitionTo is not null, it is assumed that this is a
user recoverable/flow recoverable error.  The engine will clear the err object from context.flow.err after your
error function returns.

If 'err' exists and *no stateNameToTransitionTo*, then no transition occurs and engine middleware treats the error as
a internal server error and will NOT attempt to render but will propagate the error via then 'next(err)' semantics
that is used by express.

State transitions will be permitted on errors if the stateNameToTransitionTo is *not the current state or the
original requested state*.

In your error handler, DO NOT clear, null, or delete the context.flow.err that is set by the framework.   If you
experience an addition error in your error function, then feel free to override the existing error that context.flow.err
points to if it makes sense for your case.

###### Specifically for errors occurring in onEntry

For rendering to occur, You *MUST* pass back err in the callback.

When you pass back a state name from your error handler, 'stateNameToTransitionTo' MUST be actual state name and NOT a
transition key.


######  Specifically for errors occurring in onExit,

Use callback(null, null) to use the configured nextState.

Use callback(err, stateNameToTransitionTo) to override the configured nextState.  If you attempt to use
callback(null, stateNameToTransitionTo), the stateNameToTransitionTo is ignored and the configured nextState is still
used.


You use an actually state name in the stateName param when err is not null.  This state will over-ride
the configured next state and the engine will clear the err object from context.flow.err since it is assumed that the
err was user recoverable since you passed in a next state to transition to. A state transition will not occur if
stateName is the current state or originally requested( so onEntry() will NOT be called again for ).

If you pass in an error and a null stateName, then no transition occurs and engine treats the error as a internal
server error and will NOT attempt to render but will propagate the error via then 'next(err)' semantics that is used
by express


##### Redirect behaviour

If you would like to the middleware to redirect (instead of render) after your state successful executes, then
you need to set your the flow control parameter in your state's function and call your end event.


`context.data = {
     flowControl: {
         redirectURL: "http://www.johnraber.net",
         redirectHeaders: {
            // this is provided by the framework but your use should be carefully evaluated
         }
     }
});`


Please note that in order to redirect out of a flow, the flow engine will rewind from all subflows to the parent flow by
using the registered end states.  If you are already, in the parent flow, then you just need to ensure and end state is
called. The flow state will be cleared from the session as well so there is no returning to this flow instance.


##### Schema of the context param that is passed into many of the functions (onEntry, onExit, error) you have to define is:

 ```javascript
 context { 
 	data: { },
 	// flow should be thought of as read-only ... if you change it in your handler functions it will not be
 	// used by the framework since the framework hands your functions it's very own copy
 	flow {
        id,
        name,
        currentStateName,
        currentStateId,
        subflow,   // isSubflow
        requestedEvent,
        requestedStateName,
        [err: { message, status } ]   // error data from your error fn , null implies success
    },
    request {
    },
    response {
    }
}
```

##### Schema that will be the request and response payloads received and returned to the middleware handler:

````javascript
{
    viewName:  // defaults to value in your flow definition file unless you set context.flow.viewName in you execute/success/error function(s)
    data: { },
    flow: {
        flowExecutionKey,
        currentStateName,
        currentSubflowName,
        viewName,
        comprehensivePreviousStates,
        [err: { message, status } ]   // error data from your error fn , null implies success
    }
}
````

##### Http response codes
The framework will interpret certain error cases into 4xx or 5xx depending on the case.  As an app writer it is strongly
suggested that you handle errors in a manner that is acceptable to your application.  A good place to start
http://expressjs.com/guide.html#error-handling

Errors that occur before running or resuming a flow will NOT be rendered by the flow engine or it's middleware and will
be passed via then 'next(err)' semantics that is used by express. This assumes the flow author will handle and render
appropriately.  The framework will append the property flow.err.status to the 'err' object:

404 :  Requested flow id is not an existing flow in the stored session

410 :  Flow has completed previously

406 :  The flow execution key does NOT contain the requestor current state for flow

406 :  Request event is NOT valid for the current state in the flow execution key

406 :  No requested event for flow

Errors that the engine and its middleware will render because the flow was run:

401:   occurs if you attempt to access a flow for which user does NOT have the acceptable role(s)

500:   Non-user recoverable error


##### Monitoring via listening to all the flow events as defined by the Flow Events module, use:

`SeñorDirector.registerFlowEventListener( new FlowEventListener('you') )`


##### Logging
Turn on logging by using the NODE_DEBUG=flowambassdor when starting the process using the flow engine


##### Authorization via Securing a flow
Authorization roles is flow scoped.  A parent flow's security roles do NOT convey to a subflow(s).
If no roles exist, then a flow or subflow is viewed as unsecured.

Note that each flow can define their own authorization delegate but this is not the nominal case. If a subflow has
no authorization delegate, then the parent flow authorization delegate will be used.

If you want authorization, provide an authorization delegate.  Use and override the prototype methods in:

[Authorization delegate base class/object](lib/authorizationDelegate.js).

Somewhere in your code:

`authorizationDelegate = new AuthorizationDelegate('some id that makes sense to your app')`


##### Global transitions
These transitions will be applied to *ALL* states in the flow that they are defined.  Transitions are flow scoped so do
not automatically apply to parent or subflows.

`globalTransitions: {
        genericUserError: 'genericPurchaseErrorState'   
    }`



##### Contributing

Bugs and new features should be submitted using [Github issues](https://github.com/johnraber/flowAmbassador/issues/new). Please include with a detailed description and the expected behaviour. If you would like to submit a change yourself do the following steps.

1. Fork it.
2. Create a branch (`git checkout -b fix-for-that-thing`)
3. Commit a failing test (`git commit -am "adds a failing test to demonstrate that thing"`)
3. Commit a fix that makes the test pass (`git commit -am "fixes that thing"`)
4. Push to the branch (`git push origin fix-for-that-thing`)
5. Open a [Pull Request](https://github.com/johnraber/flowAmbassador/pulls)

Please keep your branch up to date by rebasing upstream changes from master.