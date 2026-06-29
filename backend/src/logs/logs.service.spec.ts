import { LogsService } from './logs.service';
import { LogsRepository } from './logs.repository';

describe('LogsService', () => {
  it('enfileira registro de log', async () => {
    const repo = { create: jest.fn(), findMany: jest.fn() } as unknown as LogsRepository;
    const queue = { enqueue: jest.fn().mockResolvedValue({ id: '1' }), registerWorker: jest.fn() };
    const svc = new LogsService(repo, queue as never);
    svc.onModuleInit();
    await svc.record('test.action', { ok: true });
    expect(queue.enqueue).toHaveBeenCalledWith('logs.persist', { action: 'test.action', payload: { ok: true } });
  });
});
