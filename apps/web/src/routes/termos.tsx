import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@/lib/legal";

/**
 * Termos de Uso — públicos, como a Política de Privacidade. O ponto central é
 * o mesmo dos avisos dentro do app: o Habitual Fit organiza e acompanha, mas
 * não substitui educador físico, nutricionista ou médico.
 */
export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Habitual Fit" },
      {
        name: "description",
        content: "As regras de uso do Habitual Fit, o que o app oferece e os seus limites.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPage
      titulo="Termos de Uso"
      resumo={
        <>
          <strong>Em poucas palavras:</strong> o Habitual Fit ajuda você a organizar e acompanhar
          treinos, alimentação e progresso. Ele <strong>não substitui</strong> a orientação de um
          profissional de educação física, de um nutricionista ou de um médico. Seus dados são seus,
          e você pode encerrar sua conta quando quiser.
        </>
      }
    >
      <Secao titulo="1. Aceitação">
        <p>
          Estes Termos regem o uso do aplicativo Habitual Fit, oferecido por{" "}
          <strong>{identificacaoEmpresa()}</strong>. Ao criar uma conta ou usar o app, você concorda
          com estes Termos e declara ter lido a{" "}
          <Link to="/privacidade">Política de Privacidade</Link>. Se não concordar, não use o app.
        </p>
      </Secao>

      <Secao titulo="2. O que o app oferece">
        <p>
          O Habitual Fit permite montar e registrar rotinas de treino, organizar refeições,
          registrar peso e medidas e acompanhar sua evolução. A partir das suas respostas ao
          questionário inicial, o app sugere automaticamente um plano de treino, que você pode usar,
          ajustar ou descartar.
        </p>
      </Secao>

      <Secao titulo="3. O app não é orientação profissional">
        <ul>
          <li>
            O plano de treino sugerido é uma <strong>referência geral</strong>, gerada
            automaticamente, e não uma prescrição individual. Ele não substitui a avaliação e o
            acompanhamento de um profissional de educação física.
          </li>
          <li>
            O app <strong>não prescreve dietas</strong>. O planejamento alimentar — o que, quanto e
            quando comer — deve ser orientado por um nutricionista.
          </li>
          <li>
            Se você informar uma lesão ou dor, o app deixa de fora os exercícios que carregam a
            região, mas isso não é avaliação clínica e não garante que um exercício seja seguro para
            você. Antes de treinar com lesão, dor ou qualquer condição de saúde, procure um
            profissional de saúde.
          </li>
          <li>
            Atividade física envolve riscos. Respeite seus limites e interrompa o exercício se
            sentir dor, tontura, falta de ar ou qualquer desconforto.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. Sua conta">
        <ul>
          <li>
            Para criar uma conta, você precisa ter pelo menos 14 anos; se tiver menos de 18, precisa
            da autorização dos pais ou responsáveis.
          </li>
          <li>Informe dados verdadeiros e mantenha sua senha em sigilo.</li>
          <li>
            Você é responsável pelo que acontece na sua conta. Se perceber um acesso indevido,
            troque a senha e nos avise em <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Uso permitido">
        <p>Ao usar o app, você se compromete a não:</p>
        <ul>
          <li>violar a lei ou direitos de outras pessoas;</li>
          <li>tentar acessar dados de outras contas ou partes restritas do sistema;</li>
          <li>
            sobrecarregar, copiar em massa, fazer engenharia reversa ou interferir no funcionamento
            do app;
          </li>
          <li>
            enviar conteúdo ilegal, ofensivo ou que viole direitos de terceiros, como fotos ou
            receitas.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Seu conteúdo">
        <p>
          Os dados e o conteúdo que você registra no app (treinos, refeições, receitas, fotos,
          medidas) continuam sendo seus. Você nos autoriza a armazená-los e processá-los apenas para
          prestar o serviço a você, como descrito na{" "}
          <Link to="/privacidade">Política de Privacidade</Link>. Você pode exportá-los ou apagá-los
          a qualquer momento em <strong>Menu → Dados e conta</strong>.
        </p>
      </Secao>

      <Secao titulo="7. Propriedade intelectual">
        <p>
          O app, sua marca, seu design, seus textos e o catálogo de exercícios e alimentos pertencem
          a {EMPRESA.nome} ou a seus licenciantes. Estes Termos não transferem a você nenhum desses
          direitos, só a permissão de usar o app para fins pessoais.
        </p>
      </Secao>

      <Secao titulo="8. Disponibilidade e mudanças">
        <p>
          Trabalhamos para manter o app disponível e funcionando bem, mas ele pode passar por
          interrupções, manutenções ou falhas. Podemos incluir, alterar ou retirar recursos ao longo
          do tempo.
        </p>
      </Secao>

      <Secao titulo="9. Preço">
        <p>
          O uso do Habitual Fit é gratuito no momento. Se planos pagos forem oferecidos no futuro,
          preços e condições serão apresentados com clareza antes de qualquer cobrança, e nada será
          cobrado sem a sua contratação expressa.
        </p>
      </Secao>

      <Secao titulo="10. Responsabilidade">
        <p>
          Na medida permitida pela lei, incluindo o Código de Defesa do Consumidor, não nos
          responsabilizamos por resultados de treino ou de alimentação, nem por danos decorrentes do
          uso das sugestões do app sem acompanhamento profissional, de informações incorretas
          fornecidas por você ou de uso em desacordo com estes Termos.
        </p>
      </Secao>

      <Secao titulo="11. Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento em <strong>Menu → Dados e conta</strong>.
          Podemos suspender ou encerrar contas que violem estes Termos, avisando você sempre que
          possível.
        </p>
      </Secao>

      <Secao titulo="12. Mudanças nestes Termos">
        <p>
          Podemos atualizar estes Termos. A data no topo indica a versão em vigor, e mudanças
          relevantes serão avisadas no app antes de valer. Continuar usando o app depois disso
          significa concordar com a nova versão.
        </p>
      </Secao>

      <Secao titulo="13. Lei aplicável e foro">
        <p>
          Estes Termos seguem as leis brasileiras. Fica eleito o foro do seu domicílio para resolver
          qualquer questão relacionada a eles.
        </p>
      </Secao>
    </LegalPage>
  );
}
