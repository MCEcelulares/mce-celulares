"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cpfValido = cpfValido;
function cpfValido(valor) {
    const cpf = valor.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf))
        return false;
    const digito = (qtd) => {
        let soma = 0;
        for (let i = 0; i < qtd; i++)
            soma += Number(cpf[i]) * (qtd + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
