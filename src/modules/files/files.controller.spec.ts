import { FilesController } from './files.controller';

const svc = () => ({
  getUploadUrl: jest.fn().mockResolvedValue({ url: 'u', key: 'k' }),
  getDownloadUrl: jest.fn().mockResolvedValue('https://download'),
  delete: jest.fn().mockResolvedValue({ ok: true }),
});

describe('FilesController', () => {
  let s: ReturnType<typeof svc>;
  let c: FilesController;
  beforeEach(() => {
    s = svc();
    c = new FilesController(s as never);
  });

  it('getUploadUrl extracts folder/filename/contentType from body', async () => {
    await c.getUploadUrl({
      folder: 'docs',
      filename: 'a.pdf',
      contentType: 'application/pdf',
    });
    expect(s.getUploadUrl).toHaveBeenCalledWith(
      'docs',
      'a.pdf',
      'application/pdf',
    );
  });
  it('getDownloadUrl', async () => {
    await c.getDownloadUrl('key123');
    expect(s.getDownloadUrl).toHaveBeenCalledWith('key123');
  });
  it('delete', async () => {
    await c.delete('key123');
    expect(s.delete).toHaveBeenCalledWith('key123');
  });
});
