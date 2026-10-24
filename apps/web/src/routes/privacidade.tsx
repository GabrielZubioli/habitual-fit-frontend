import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@/lib/legal";

/**
 * Política de Privacidade — pública (o Google exige a URL na tela de
 * consentimento do login) e escrita para o app como ele é hoje: o que coleta,
 * por quê, com quem compartilha e como a pessoa exerce os direitos da LGPD.
 */
export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Habitual Fit" },
      {
        name: "description",
        content: "Como o Habitual Fit coleta, usa, guarda e protege os seus dados pessoais.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalPage
      titulo="Política de Privacidade"
      resumo={
        <>
          <strong>Em poucas palavras:</strong> usamos seus dados só para fazer o Habitual Fit
          funcionar para você — montar seu treino, registrar sua dieta e mostrar seu progresso. Não
          vendemos seus dados, não mostramos anúncios e não usamos ferramentas de rastreamento de
          terceiros. Você pode exportar ou apagar tudo a qualquer momento, pelo próprio app.
        </>
      }
    >
      <Secao titulo="1. Quem somos">
        <p>
          O Habitual Fit é um aplicativo para organizar e acompanhar treinos, alimentação e
          progresso corporal, oferecido por <strong>{identificacaoEmpresa()}</strong>, que é a
          controladora dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados (Lei nº
          13.709/2018, a LGPD).
        </p>
        <p>
          Para qualquer assunto sobre seus dados, inclusive para falar com o encarregado pelo
          tratamento de dados, escreva para <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
        </p>
      </Secao>

      <Secao titulo="2. Quais dados coletamos">
        <p>Coletamos apenas o que você nos informa ou registra ao usar o app:</p>
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail e senha. A senha é guardada de forma cifrada e
            ninguém da equipe tem acesso a ela. Se você entrar com o Google, recebemos do Google
            apenas seu nome, e-mail e foto de perfil.
          </li>
          <li>
            <strong>Perfil e questionário inicial:</strong> sexo, idade ou data de nascimento,
            altura, peso, meta de peso, objetivo, nível de experiência, local e equipamentos de
            treino, dias e duração disponíveis, região que quer priorizar e número de refeições.
          </li>
          <li>
            <strong>Informações de saúde que você escolher informar:</strong> lesões ou dores,
            condições de saúde, alergias e restrições alimentares.
          </li>
          <li>
            <strong>O que você registra:</strong> treinos (exercícios, séries, repetições, cargas e
            datas), rotinas, refeições e alimentos, consumo de água, pesagens e medidas corporais,
            receitas que você cria, exercícios favoritos e sua foto de perfil.
          </li>
          <li>
            <strong>Dados técnicos:</strong> os necessários para manter você conectado com
            segurança. O navegador também guarda no seu aparelho preferências como o tema (claro ou
            escuro) e o rascunho do questionário — esses ficam só com você.
          </li>
        </ul>
        <p>
          Não usamos cookies de publicidade nem ferramentas de análise ou rastreamento de terceiros.
        </p>
      </Secao>

      <Secao titulo="3. Dados de saúde">
        <p>
          Peso, medidas, lesões, dores, condições de saúde e alergias são{" "}
          <strong>dados pessoais sensíveis</strong> pela LGPD. Eles só são tratados porque você
          escolhe informá-los, com o seu consentimento, e apenas para montar seu plano de treino,
          organizar sua alimentação e mostrar sua evolução. Você pode alterá-los ou apagá-los quando
          quiser, e revogar o consentimento a qualquer momento — nesse caso, recursos que dependem
          desses dados podem deixar de funcionar como antes.
        </p>
      </Secao>

      <Secao titulo="4. Para que usamos seus dados">
        <ul>
          <li>Criar e manter sua conta e permitir que você entre no app.</li>
          <li>
            Montar o plano de treino sugerido a partir das suas respostas — ele é uma referência
            geral, gerada automaticamente, e não uma avaliação individual.
          </li>
          <li>Registrar e mostrar seus treinos, sua dieta e seu progresso.</li>
          <li>Proteger o serviço contra fraude, abuso e acessos indevidos.</li>
          <li>Responder às suas mensagens e pedidos de suporte.</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
        </ul>
        <p>
          Não vendemos, alugamos ou cedemos seus dados para publicidade, e não os usamos para traçar
          perfis de consumo.
        </p>
      </Secao>

      <Secao titulo="5. Bases legais">
        <ul>
          <li>
            <strong>Execução de contrato</strong> (art. 7º, V, da LGPD): para prestar o serviço que
            você contratou ao criar sua conta.
          </li>
          <li>
            <strong>Consentimento</strong> (art. 11, I): para os dados de saúde que você decide
            informar.
          </li>
          <li>
            <strong>Legítimo interesse</strong> (art. 7º, IX): para segurança e prevenção a abuso.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): por exemplo, a guarda de
            registros de acesso exigida pelo Marco Civil da Internet.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Com quem compartilhamos">
        <p>
          Seus dados não são vendidos nem compartilhados com anunciantes. Eles passam apenas por
          fornecedores que nos ajudam a operar o app, sob contrato e só para esse fim:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos
            (como a foto de perfil).
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do aplicativo.
          </li>
          <li>
            <strong>Google</strong> — somente se você escolher entrar com sua conta Google, para
            confirmar sua identidade.
          </li>
        </ul>
        <p>
          Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade
          competente. Quando você usa a opção de compartilhar seu perfil, o app gera uma imagem no
          seu aparelho apenas com as informações que você marcar; ela só sai do app se você mesmo a
          enviar. Não existe página pública do seu perfil.
        </p>
      </Secao>

      <Secao titulo="7. Transferência internacional">
        <p>
          Os servidores dos nossos fornecedores podem ficar fora do Brasil, inclusive nos Estados
          Unidos. Nessas transferências exigimos garantias de proteção compatíveis com a LGPD (art.
          33).
        </p>
      </Secao>

      <Secao titulo="8. Por quanto tempo guardamos">
        <p>
          Guardamos seus dados enquanto sua conta existir. Quando você exclui a conta, apagamos seus
          dados e arquivos. Podem permanecer, por tempo limitado, cópias de segurança que são
          sobrescritas automaticamente, e registros que a lei nos obriga a manter — como os
          registros de acesso a aplicações, guardados por 6 meses (art. 15 do Marco Civil da
          Internet).
        </p>
      </Secao>

      <Secao titulo="9. Seus direitos">
        <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>pedir a anonimização, o bloqueio ou a eliminação de dados;</li>
          <li>pedir a portabilidade dos seus dados;</li>
          <li>saber com quem compartilhamos seus dados;</li>
          <li>revogar o consentimento dado para os dados de saúde.</li>
        </ul>
        <p>
          Boa parte disso você faz sozinho no app: edite seus dados no <strong>Perfil</strong> e, em{" "}
          <strong>Menu → Dados e conta</strong>, exporte uma cópia de tudo ou exclua sua conta
          definitivamente. Para os demais pedidos, escreva para{" "}
          <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a> — respondemos em até 15 dias. Você
          também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao titulo="10. Segurança">
        <p>
          Toda a comunicação com o app é cifrada (HTTPS), a senha é guardada cifrada e cada pessoa
          só tem acesso aos próprios dados — a regra é aplicada no próprio banco de dados, não só na
          tela. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente de segurança que
          possa trazer risco a você, avisaremos você e a ANPD, como prevê a lei.
        </p>
      </Secao>

      <Secao titulo="11. Crianças e adolescentes">
        <p>
          O Habitual Fit não é destinado a menores de 14 anos. Adolescentes entre 14 e 17 anos só
          devem usá-lo com o consentimento e o acompanhamento dos pais ou responsáveis.
        </p>
      </Secao>

      <Secao titulo="12. Mudanças nesta política">
        <p>
          Podemos atualizar esta política quando o app mudar — por exemplo, ao lançar novos
          recursos. A data no topo da página indica a versão em vigor, e mudanças relevantes serão
          avisadas no app antes de valer. Veja também os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </Secao>
    </LegalPage>
  );
}
