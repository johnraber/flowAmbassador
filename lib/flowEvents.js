'use strict';


/**
 * Internal event names to be used for flow monitoring and management as the flow framework matures.
 *
 */
module.exports = {

    /**
     * Start state has been executed successfully
     */
    FLOW_START: 'flow_start',

    /**
     * Flow is rendering a state
     */
    FLOW_RENDER: 'flow_render',

    /**
     * Flow has experienced an error with is not a client recoverable so http is a 500 type
     */
    FLOW_ERROR: 'flow_error',

    /**
     * Flow has been aborted
     */
    FLOW_ABORT: 'flow_abort',

    /**
     * Flow has completed successfully
     */
    FLOW_COMPLETE: 'flow_complete',


    FLOW_STATE_TRANSITION: 'flow_state_transition'

};