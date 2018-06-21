import { Promise } from 'bluebird';
import { Handler, NextFunction, Request, Response } from 'express';

/**
 * @module root
 */

// These are external to the module - should be exported from @vamship/logger
export interface ILogger {
    trace: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
    child: (props: { [prop: string]: string }) => ILogger;
}

// These are external to the module - should be exported from @vamship/config
export interface IConfig {
    get: (prop: string) => any;
}

/**
 * A context object that provides information on the execution context of the
 * handler. This object is reserved for future use.
 */
export interface IContext {
    [prop: string]: any;
}

/**
 * The input to the request handler function.
 */
export interface IInput {
    [prop: string]: any;
}

/**
 * An extended properties interface that is passed on to a handler at run time.
 */
export interface IExtendedProperties {
    /**
     * Reference to an initialized logger object
     */
    logger: ILogger;

    /**
     * Reference to a config object for the current application.
     */
    config: IConfig;

    /**
     * An alias string that defines the current execution environment.
     */
    alias: string;
}

/**
 * An input mapper function that receives the request from expressjs, and maps
 * it to an object that can be processed by the handler.
 *
 * @param req The expressjs request object.
 * @returns An object that is passed to the handler function for processing.
 */
export type InputMapper = (req: Request) => {};

/**
 * Input mapper function that receives the request from expressjs, and maps it
 * to an object that can be processed by the handler.
 *
 * @param input A parsed input object that can be handled by the handler
 * @param context A context object that contains metadata about the current
 *        execution. This object is reserved for future enhancements
 * @param ext An extended properties object that includes references to useful
 *        entities such as loggers, config objects, etc.
 *
 * @returns A promise or object that is the result of processing the request.
 *          If a promise is returned, the handler will wait for the promise to
 *          be fulfilled before proceeding.
 */
export type RequestHandler = (
    input: IInput,
    context: IContext,
    ext: IExtendedProperties
) => any | Promise;

/**
 * An output mapper function that takes the output from the handler, and turns
 * it into an HTTP response.
 * @param data The output from the handler
 * @param res The expressjs response object
 *
 * @param next The expressjs next function that can be used to pass control to
 *        the next handler in expressjs' handler chain. This is typically
 *        used to pass an error down to an error handler routine.
 */
export type OutputMapper = (
    data: {
        [prop: string]: any;
    },
    res: Response,
    next: NextFunction
) => any | Promise;

/**
 * The standard definition for a route definition module. These modules can
 * be used to configure routes on expressjs, linking them to standard processing
 * flows that include input mapping, schema validation, request processing and
 * output mapping.
 */
export interface IRouteDefinition {
    /**
     * The HTTP method to apply to the route
     */
    method: string;

    /**
     * The URL path to the http request
     */
    path: string;

    /**
     * The handler function that will handle requests to the route.
     */
    handler: RequestHandler;

    /**
     * An optional input mapping definition to use when mapping the HTTP request
     * to the handler input.
     */
    inputMapper: { [prop: string]: string } | InputMapper;

    /**
     * An optional input output definition to use when handling the output of
     * the handler to an HTTP response.
     */
    outputMapper?: OutputMapper;

    /**
     * An optional schema to validate requests after the input mapper has mapped
     * the HTTP request to the input object.
     */
    schema?: {};
}
