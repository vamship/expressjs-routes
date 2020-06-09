/**
 * @module root
 */
import { Promise } from 'bluebird';
import { NextFunction, Request, Response } from 'express';

/**
 * Logger object that is provided to the handler for logging purposes.
 */
export interface ILogger {
    /**
     * Logs trace level messages.
     */
    trace: (...args: unknown[]) => void;

    /**
     * Logs debug level messages.
     */
    debug: (...args: unknown[]) => void;

    /**
     * Logs info level messages.
     */
    info: (...args: unknown[]) => void;

    /**
     * Logs warn level messages.
     */
    warn: (...args: unknown[]) => void;

    /**
     * Logs error level messages.
     */
    error: (...args: unknown[]) => void;

    /**
     * Logs fatal level messages.
     */
    fatal: (...args: unknown[]) => void;

    /**
     * Creates a child logger with the given properties.
     */
    child: (props: { [prop: string]: string }) => ILogger;
}

/**
 * A context object that provides information on the execution context of the
 * handler. This object is reserved for future use.
 */
export interface IContext {
    /**
     * A unique request id that can be used to correlate log messages and the
     * like. Generated for every request.
     */
    requestId: string;
}

/**
 * The input to the request handler function.
 */
export interface IInput {
    [prop: string]: unknown;
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
 * Request processor function that accepts an input object, processes it, and
 * returns the result. The result can be immediate or can be a promise to allow
 * for asynchronous processing.
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
) => Promise;

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
        [prop: string]: unknown;
    },
    res: Response,
    next: NextFunction
) => Promise;

/**
 * The standard definition for a route definition module. Objects that conform
 * to this interface can be used to define declarative routes for expressjs.
 *
 * These definitions can be leveraged by standardized routines that build actual
 * routes that include input mapping, schema validation, request processing and
 * output mapping.
 */
export interface IRouteDefinition {
    /**
     * An optional name for the handler.
     */
    name?: string;

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
