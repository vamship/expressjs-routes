import _loggerProvider from '@vamship/logger';
import { Router } from 'express';
import HandlerBuilder from './handler-builder';
import { IRouteDefinition } from './handler-types';

const _logger = _loggerProvider.getLogger('routes');

/**
 * Builds routes for a specific router based on delcarative route definitions.
 *
 * @param routes Route definitions for the routes that need to be mounted on the
 *        router.
 */
export default (routes: IRouteDefinition[]): Router => {
    _logger.trace('Creating new router object');
    const router = Router();

    _logger.trace('Adding routes to router');
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
        const logger = _logger.child({
            route: handlerName
        });

        logger.trace('Creating route builder');
        const builder = new HandlerBuilder(handlerName, handler).setInputMapper(
            inputMapper
        );

        if (schema) {
            _logger.trace('Adding schema validation');
            builder.setSchema(schema);
        }

        if (outputMapper) {
            _logger.trace('Adding output mapper');
            builder.setOutputMapper(outputMapper);
        }

        logger.trace('Mounting route to router');
        router[method.toLowerCase()](path, builder.build());
    });

    return router;
};
