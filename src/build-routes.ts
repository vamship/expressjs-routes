/**
 * @module root
 */
import _loggerProvider from '@vamship/logger';
import { Router } from 'express';
import HandlerBuilder from './handler-builder';
import { IRouteDefinition } from './handler-types';

/**
 * Builds routes for a specific router based on delcarative route definitions.
 *
 * @param routes Route definitions for the routes that need to be mounted on the
 *        router.
 */
function buildRoutes(routes: IRouteDefinition[]): Router {
    const logger = _loggerProvider.getLogger('buildRoutes');

    logger.trace('Creating new router object');
    const router = Router();

    logger.trace('Adding routes to router');
    routes.forEach((definition) => {
        const {
            method,
            path,
            handler,
            inputMapper,
            schema,
            outputMapper
        } = definition;

        const handlerName = `${method} ${path}`;
        const builderLogger = logger.child({
            route: handlerName
        });

        builderLogger.trace('Creating route builder');
        const builder = new HandlerBuilder(handlerName, handler).setInputMapper(
            inputMapper
        );

        if (schema) {
            builderLogger.trace('Adding schema validation');
            builder.setSchema(schema);
        }

        if (outputMapper) {
            builderLogger.trace('Adding output mapper');
            builder.setOutputMapper(outputMapper);
        }

        builderLogger.trace('Mounting route to router');
        router[method.toLowerCase()](path, builder.build());
    });

    return router;
}

export default buildRoutes;
