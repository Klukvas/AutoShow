import { BadRequestException } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'node:crypto';
import { BillingWebhookController } from './billing-webhook.controller';
import { MonobankSignatureVerifier } from './monobank-signature';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const body = Buffer.from(JSON.stringify({ invoiceId: 'p2_abc', status: 'success' }));
const goodSign = sign('sha256', body, privateKey).toString('base64');

function setup(isEnabled = true) {
  const verifier = new MonobankSignatureVerifier(async () => pem);
  const monobank = { verifyWebhook: (raw: Buffer, s: string) => verifier.verify(raw, s) };
  const billing = { isEnabled, handleWebhook: jest.fn().mockResolvedValue('credited') };
  const controller = new BillingWebhookController(billing as never, monobank as never);
  return { controller, billing };
}

const request = (rawBody: Buffer | undefined) => ({ rawBody }) as never;

describe('BillingWebhookController', () => {
  it('hands a correctly signed webhook to the service', async () => {
    const { controller, billing } = setup();
    await expect(controller.webhook(request(body), goodSign)).resolves.toEqual({ ok: true });
    expect(billing.handleWebhook).toHaveBeenCalledWith('p2_abc');
  });

  it('rejects a tampered body with 400 and changes nothing', async () => {
    const { controller, billing } = setup();
    const tampered = Buffer.from(body.toString().replace('p2_abc', 'p2_xyz'));
    await expect(controller.webhook(request(tampered), goodSign)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(billing.handleWebhook).not.toHaveBeenCalled();
  });

  it('rejects a missing signature or raw body', async () => {
    const { controller, billing } = setup();
    await expect(controller.webhook(request(body), undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.webhook(request(undefined), goodSign)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(billing.handleWebhook).not.toHaveBeenCalled();
  });

  it('acknowledges but ignores webhooks while billing is disabled', async () => {
    const { controller, billing } = setup(false);
    await expect(controller.webhook(request(body), 'whatever')).resolves.toEqual({ ok: true });
    expect(billing.handleWebhook).not.toHaveBeenCalled();
  });
});
