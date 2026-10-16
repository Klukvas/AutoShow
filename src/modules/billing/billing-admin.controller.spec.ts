import { BillingAdminController } from './billing-admin.controller';

describe('BillingAdminController.status', () => {
  const billing = {
    getAdminStatus: jest.fn().mockResolvedValue({ enabled: true, monthlyPriceUah: 500 }),
    getEditorStatus: jest.fn().mockResolvedValue({ enabled: true, blocked: false }),
  };
  const controller = new BillingAdminController(billing as never);

  it('gives an editor only the enabled/blocked flags', async () => {
    const result = await controller.status({ id: 'e', email: 'e@x', role: 'editor' });
    expect(result).toEqual({ enabled: true, blocked: false });
    expect(billing.getAdminStatus).not.toHaveBeenCalled();
  });

  it('gives the admin the full status', async () => {
    const result = await controller.status({ id: 'a', email: 'a@x', role: 'admin' });
    expect(result).toMatchObject({ monthlyPriceUah: 500 });
  });
});
