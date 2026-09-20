import 'reflect-metadata';

/**
 * KC_AUTH_DATE_TYPE is read when the entity module is first imported, so each
 * case needs a fresh module registry.
 */
describe('KC_AUTH_DATE_TYPE', () => {
  const original = process.env.KC_AUTH_DATE_TYPE;

  afterEach(() => {
    if (original === undefined) delete process.env.KC_AUTH_DATE_TYPE;
    else process.env.KC_AUTH_DATE_TYPE = original;
    jest.resetModules();
  });

  const columnType = (entity: any, propertyName: string): unknown => {
    const { getMetadataArgsStorage } = require('typeorm');
    const column = getMetadataArgsStorage().columns.find(
      (c: any) => c.target === entity && c.propertyName === propertyName,
    );
    return column?.options?.type;
  };

  it('leaves the type to the driver when unset', () => {
    delete process.env.KC_AUTH_DATE_TYPE;
    jest.resetModules();
    const { KcUserEntity } = require('../src/adapters/typeorm.entities');
    // @CreateDateColumn falls back to the driver's mapped type; a plain
    // @Column keeps the reflected `Date`, which is what it did before 0.3.0.
    expect(columnType(KcUserEntity, 'createdAt')).toBeUndefined();
    expect(columnType(KcUserEntity, 'lastLoginAt')).toBe(Date);
  });

  it('applies timestamptz to every date column when asked', () => {
    process.env.KC_AUTH_DATE_TYPE = 'timestamptz';
    jest.resetModules();
    const {
      KcUserEntity,
      KcRefreshTokenEntity,
      KcVerificationCodeEntity,
      KcProfileEntity,
    } = require('../src/adapters/typeorm.entities');

    expect(columnType(KcUserEntity, 'createdAt')).toBe('timestamptz');
    expect(columnType(KcUserEntity, 'updatedAt')).toBe('timestamptz');
    expect(columnType(KcUserEntity, 'lastLoginAt')).toBe('timestamptz');
    expect(columnType(KcRefreshTokenEntity, 'expiresAt')).toBe('timestamptz');
    expect(columnType(KcVerificationCodeEntity, 'expiresAt')).toBe('timestamptz');
    expect(columnType(KcProfileEntity, 'createdAt')).toBe('timestamptz');
  });

  it('fails fast on an unsupported value', () => {
    process.env.KC_AUTH_DATE_TYPE = 'epoch';
    jest.resetModules();
    expect(() => require('../src/adapters/typeorm.entities')).toThrow(/KC_AUTH_DATE_TYPE/);
  });
});
