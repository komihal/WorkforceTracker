describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show login screen', async () => {
    await expect(element(by.text('Вход в систему'))).toBeVisible();
    await expect(element(by.text('Войти'))).toBeVisible();
  });

  it('should format phone number with +7 prefix', async () => {
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('9161234567');
    await expect(element(by.text('+7'))).toBeVisible();
  });

  it('should show error for incomplete phone', async () => {
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('916');

    const passwordInput = element(by.id('password-input'));
    await passwordInput.typeText('test123');

    await element(by.text('Войти')).tap();
    await expect(element(by.text('Ошибка'))).toBeVisible();
  });

  it('should login successfully with valid credentials', async () => {
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('9999999999');

    const passwordInput = element(by.id('password-input'));
    await passwordInput.typeText('123456');

    await element(by.text('Войти')).tap();

    // After successful login, should navigate away from login screen
    await waitFor(element(by.text('Успех')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
