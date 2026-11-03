import { Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@forja/app-core/lib/legal";

/**
 * Termos de Uso em espanhol — tradução de `routes/termos.tsx`. Ao mudar o
 * texto em português, atualize aqui e na versão em inglês (revisão jurídica).
 */
export function TermosEs() {
  return (
    <LegalPage
      titulo="Términos de uso"
      resumo={
        <>
          <strong>En pocas palabras:</strong> Habitual Fit te ayuda a organizar y seguir tus
          entrenamientos, tu alimentación y tu progreso. <strong>No sustituye</strong> la
          orientación de un entrenador certificado, de un nutricionista ni de un médico. Tus datos
          son tuyos, y puedes cerrar tu cuenta cuando quieras.
          <br />
          <br />
          <em>
            Esta es una traducción de la versión original en portugués. En caso de conflicto,
            prevalece la versión en portugués.
          </em>
        </>
      }
    >
      <Secao titulo="1. Aceptación">
        <p>
          Estos Términos regulan el uso de la aplicación Habitual Fit, ofrecida por{" "}
          <strong>{identificacaoEmpresa()}</strong>. Al crear una cuenta o usar la app, aceptas
          estos Términos y declaras haber leído la{" "}
          <Link to="/privacidade">Política de privacidad</Link>. Si no estás de acuerdo, no uses la
          app.
        </p>
      </Secao>

      <Secao titulo="2. Lo que ofrece la app">
        <p>
          Habitual Fit permite armar y registrar rutinas de entrenamiento, organizar comidas,
          registrar peso y medidas y seguir tu evolución. A partir de tus respuestas al cuestionario
          inicial, la app sugiere automáticamente un plan de entrenamiento, que puedes usar, ajustar
          o descartar.
        </p>
      </Secao>

      <Secao titulo="3. La app no es orientación profesional">
        <ul>
          <li>
            El plan de entrenamiento sugerido es una <strong>referencia general</strong>, generada
            automáticamente, y no una prescripción individual. No sustituye la evaluación y el
            seguimiento de un entrenador certificado.
          </li>
          <li>
            La app <strong>no prescribe dietas</strong>. La planificación alimentaria — qué, cuánto
            y cuándo comer — debe estar orientada por un nutricionista.
          </li>
          <li>
            Si informas una lesión o dolor, la app deja fuera los ejercicios que cargan esa zona,
            pero eso no es una evaluación clínica y no garantiza que un ejercicio sea seguro para
            ti. Antes de entrenar con una lesión, dolor o cualquier condición de salud, consulta a
            un profesional de la salud.
          </li>
          <li>
            La actividad física implica riesgos. Respeta tus límites y detén el ejercicio si sientes
            dolor, mareo, falta de aire o cualquier molestia.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. Tu cuenta">
        <ul>
          <li>
            Para crear una cuenta, debes tener al menos 14 años; si tienes menos de 18, necesitas la
            autorización de tus padres o tutores.
          </li>
          <li>Proporciona datos verdaderos y mantén tu contraseña en secreto.</li>
          <li>
            Eres responsable de lo que ocurre en tu cuenta. Si notas un acceso indebido, cambia la
            contraseña y avísanos en <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Uso permitido">
        <p>Al usar la app, te comprometes a no:</p>
        <ul>
          <li>violar la ley ni los derechos de otras personas;</li>
          <li>intentar acceder a datos de otras cuentas o a partes restringidas del sistema;</li>
          <li>
            sobrecargar, copiar masivamente, hacer ingeniería inversa o interferir en el
            funcionamiento de la app;
          </li>
          <li>
            subir contenido ilegal, ofensivo o que viole derechos de terceros, como fotos o recetas.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Tu contenido">
        <p>
          Los datos y el contenido que registras en la app (entrenamientos, comidas, recetas, fotos,
          medidas) siguen siendo tuyos. Nos autorizas a almacenarlos y tratarlos solo para prestarte
          el servicio, como se describe en la <Link to="/privacidade">Política de privacidad</Link>.
          Puedes exportarlos o borrarlos en cualquier momento en{" "}
          <strong>Menú → Datos y cuenta</strong>.
        </p>
      </Secao>

      <Secao titulo="7. Propiedad intelectual">
        <p>
          La app, su marca, su diseño, sus textos y el catálogo de ejercicios y alimentos pertenecen
          a {EMPRESA.nome} o a sus licenciantes. Estos Términos no te transfieren ninguno de esos
          derechos, solo el permiso de usar la app con fines personales.
        </p>
      </Secao>

      <Secao titulo="8. Disponibilidad y cambios">
        <p>
          Trabajamos para mantener la app disponible y funcionando bien, pero puede sufrir
          interrupciones, mantenimientos o fallas. Podemos agregar, cambiar o retirar funciones con
          el tiempo.
        </p>
      </Secao>

      <Secao titulo="9. Precio">
        <p>
          El uso de Habitual Fit es gratuito por ahora. Si en el futuro se ofrecen planes pagos, los
          precios y condiciones se presentarán con claridad antes de cualquier cobro, y no se
          cobrará nada sin tu contratación expresa.
        </p>
      </Secao>

      <Secao titulo="10. Responsabilidad">
        <p>
          En la medida permitida por la ley, incluido el Código de Defensa del Consumidor de Brasil,
          no nos responsabilizamos por resultados de entrenamiento o de alimentación, ni por daños
          derivados del uso de las sugerencias de la app sin acompañamiento profesional, de
          información incorrecta que proporciones o del uso contrario a estos Términos.
        </p>
      </Secao>

      <Secao titulo="11. Terminación">
        <p>
          Puedes eliminar tu cuenta en cualquier momento en <strong>Menú → Datos y cuenta</strong>.
          Podemos suspender o cerrar cuentas que violen estos Términos, avisándote siempre que sea
          posible.
        </p>
      </Secao>

      <Secao titulo="12. Cambios en estos Términos">
        <p>
          Podemos actualizar estos Términos. La fecha de arriba indica la versión vigente, y los
          cambios relevantes se avisarán en la app antes de entrar en vigor. Seguir usando la app
          después de eso significa aceptar la nueva versión.
        </p>
      </Secao>

      <Secao titulo="13. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de Brasil. Se elige el fuero de tu domicilio para
          resolver cualquier cuestión relacionada con ellos.
        </p>
      </Secao>
    </LegalPage>
  );
}
