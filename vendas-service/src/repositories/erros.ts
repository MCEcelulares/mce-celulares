export class RegistroDuplicadoError extends Error {
  constructor(mensagem = 'Registro duplicado') {
    super(mensagem);
    this.name = 'RegistroDuplicadoError';
  }
}
