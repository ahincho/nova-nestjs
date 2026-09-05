import { ConfigModule } from '@nestjs/config';
import { NovaConfigModule } from './nova-config.module';
import { defineUpstream } from './upstream';

describe('NovaConfigModule.forRoot', () => {
  let forRoot: jest.SpyInstance;

  beforeEach(() => {
    // The real one reads the filesystem and mutates process.env. What matters
    // here is the options this wrapper decides on its behalf.
    forRoot = jest
      .spyOn(ConfigModule, 'forRoot')
      .mockResolvedValue({ module: class ConfigModuleStub {} });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function optionsPassedDown(): Record<string, unknown> {
    return forRoot.mock.calls[0]?.[0] as Record<string, unknown>;
  }

  it('is global and expands variables by default', async () => {
    const module = await NovaConfigModule.forRoot();

    expect(module.global).toBe(true);
    expect(optionsPassedDown()).toMatchObject({
      isGlobal: true,
      expandVariables: true,
      load: [],
    });
  });

  it('lets a service keep the configuration out of the global scope', async () => {
    const module = await NovaConfigModule.forRoot({ isGlobal: false });

    expect(module.global).toBe(false);
    expect(optionsPassedDown()).toMatchObject({ isGlobal: false });
  });

  it('passes the declared namespaces down', async () => {
    const academic = defineUpstream('academic-orchestrator');

    await NovaConfigModule.forRoot({ load: [academic] });

    expect(optionsPassedDown()['load']).toEqual([academic]);
  });

  it.each([
    ['a single path', '.env.local', ['.env.local']],
    ['a list of paths', ['.env.local', '.env'], ['.env.local', '.env']],
  ])('accepts %s', async (_label, envFilePath, expected) => {
    await NovaConfigModule.forRoot({ envFilePath });

    expect(optionsPassedDown()['envFilePath']).toEqual(expected);
  });

  // Left undefined so @nestjs/config applies its own default rather than being
  // handed an empty list, which it would read as "no files at all".
  it('leaves the env files unset when none are given', async () => {
    await NovaConfigModule.forRoot();

    expect(optionsPassedDown()['envFilePath']).toBeUndefined();
  });

  it('forwards a validation schema untouched', async () => {
    const schema = { validate: () => ({ value: {} }) };

    await NovaConfigModule.forRoot({ validationSchema: schema });

    expect(optionsPassedDown()['validationSchema']).toBe(schema);
  });

  // Awaited rather than handed over as a promise: DynamicModule.exports does
  // not accept one, which is what the async signature is for.
  it('imports and re-exports the resolved ConfigModule', async () => {
    const module = await NovaConfigModule.forRoot();

    expect(module.imports).toHaveLength(1);
    expect(module.exports).toEqual(module.imports);
  });
});
