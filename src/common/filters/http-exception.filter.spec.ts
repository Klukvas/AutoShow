import { BadRequestException, type ArgumentsHost, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ id: 'request-1', originalUrl: '/test' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  it('does not expose unhandled exception details', () => {
    const { host, status, json } = makeHost();

    new HttpExceptionFilter().catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'Internal server error',
      correlationId: 'request-1',
      path: '/test',
    });
  });

  it('preserves safe HTTP exception details', () => {
    const { host, status, json } = makeHost();

    new HttpExceptionFilter().catch(new BadRequestException('invalid input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'invalid input',
      }),
    );
  });
});
