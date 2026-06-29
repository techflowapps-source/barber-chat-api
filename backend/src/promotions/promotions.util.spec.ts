import { personalizePromotionMessage } from './promotions.util';

describe('promotions.util', () => {
  it('substitui {nome} pelo nome do cliente', () => {
    const out = personalizePromotionMessage('Olá {nome}, promoção!', 'João');
    expect(out).toBe('Olá João, promoção!');
  });

  it('usa "cliente" quando nome ausente', () => {
    const out = personalizePromotionMessage('Olá {nome}!', null);
    expect(out).toBe('Olá cliente!');
  });
});
