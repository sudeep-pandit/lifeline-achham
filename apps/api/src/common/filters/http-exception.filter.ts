import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

// Section 42 (Error Handling): never leak raw database/stack traces to the
// client. Known HttpExceptions pass their message through; anything else
// becomes a generic 500 while the real error is logged server-side.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === "string"
          ? { statusCode: status, message: body }
          : { statusCode: status, ...(body as object) },
      );
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Something went wrong. Please try again or contact an administrator.",
    });
  }
}
