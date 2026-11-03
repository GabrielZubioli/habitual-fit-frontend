import { Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@forja/app-core/lib/legal";

/**
 * Política de Privacidade em espanhol — tradução de `routes/privacidade.tsx`.
 * Ao mudar o texto em português, atualize aqui e na versão em inglês
 * (revisão jurídica; antes de liberar a UE, revisar também à luz do GDPR).
 */
export function PrivacidadeEs() {
  return (
    <LegalPage
      titulo="Política de privacidad"
      resumo={
        <>
          <strong>En pocas palabras:</strong> usamos tus datos solo para que Habitual Fit funcione
          para ti — armar tu entrenamiento, registrar tu dieta y mostrar tu progreso. No vendemos
          tus datos, no mostramos anuncios y no usamos herramientas de rastreo de terceros. Puedes
          exportar o borrar todo en cualquier momento, desde la propia app.
          <br />
          <br />
          <em>
            Esta es una traducción de la versión original en portugués. En caso de conflicto,
            prevalece la versión en portugués.
          </em>
        </>
      }
    >
      <Secao titulo="1. Quiénes somos">
        <p>
          Habitual Fit es una aplicación para organizar y seguir entrenamientos, alimentación y
          progreso corporal, ofrecida por <strong>{identificacaoEmpresa()}</strong>, que es la
          responsable del tratamiento de tus datos personales según la Ley General de Protección de
          Datos de Brasil (Ley n.º 13.709/2018, la LGPD).
        </p>
        <p>
          Para cualquier asunto sobre tus datos, incluso para hablar con el encargado de protección
          de datos, escribe a <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
        </p>
      </Secao>

      <Secao titulo="2. Qué datos recopilamos">
        <p>Solo recopilamos lo que nos informas o registras al usar la app:</p>
        <ul>
          <li>
            <strong>Cuenta:</strong> nombre, correo y contraseña. La contraseña se guarda cifrada y
            nadie del equipo tiene acceso a ella. Si inicias sesión con Google, recibimos de Google
            solo tu nombre, correo y foto de perfil.
          </li>
          <li>
            <strong>Perfil y cuestionario inicial:</strong> sexo, edad o fecha de nacimiento,
            altura, peso, meta de peso, objetivo, nivel de experiencia, lugar y equipos de
            entrenamiento, días y duración disponibles, zona que quieres priorizar y número de
            comidas.
          </li>
          <li>
            <strong>Información de salud que elijas informar:</strong> lesiones o dolores,
            condiciones de salud, alergias y restricciones alimentarias.
          </li>
          <li>
            <strong>Lo que registras:</strong> entrenamientos (ejercicios, series, repeticiones,
            pesos y fechas), rutinas, comidas y alimentos, consumo de agua, pesajes y medidas
            corporales, recetas que creas, ejercicios favoritos y tu foto de perfil.
          </li>
          <li>
            <strong>Datos técnicos:</strong> los necesarios para mantenerte conectado con seguridad.
            El navegador también guarda en tu dispositivo preferencias como el tema (claro u oscuro)
            y el borrador del cuestionario — esos quedan solo contigo.
          </li>
        </ul>
        <p>No usamos cookies de publicidad ni herramientas de análisis o rastreo de terceros.</p>
      </Secao>

      <Secao titulo="3. Datos de salud">
        <p>
          El peso, las medidas, las lesiones, los dolores, las condiciones de salud y las alergias
          son <strong>datos personales sensibles</strong> según la LGPD. Solo se tratan porque
          eliges informarlos, con tu consentimiento, y únicamente para armar tu plan de
          entrenamiento, organizar tu alimentación y mostrar tu evolución. Puedes cambiarlos o
          borrarlos cuando quieras, y revocar el consentimiento en cualquier momento — en ese caso,
          las funciones que dependen de esos datos pueden dejar de funcionar como antes.
        </p>
      </Secao>

      <Secao titulo="4. Para qué usamos tus datos">
        <ul>
          <li>Crear y mantener tu cuenta y permitir que inicies sesión en la app.</li>
          <li>
            Armar el plan de entrenamiento sugerido a partir de tus respuestas — es una referencia
            general, generada automáticamente, y no una evaluación individual.
          </li>
          <li>Registrar y mostrar tus entrenamientos, tu dieta y tu progreso.</li>
          <li>Proteger el servicio contra fraude, abuso y accesos indebidos.</li>
          <li>Responder a tus mensajes y solicitudes de soporte.</li>
          <li>Cumplir obligaciones legales y regulatorias.</li>
        </ul>
        <p>
          No vendemos, alquilamos ni cedemos tus datos para publicidad, y no los usamos para trazar
          perfiles de consumo.
        </p>
      </Secao>

      <Secao titulo="5. Bases legales">
        <ul>
          <li>
            <strong>Ejecución de contrato</strong> (art. 7, V, de la LGPD): para prestar el servicio
            que contrataste al crear tu cuenta.
          </li>
          <li>
            <strong>Consentimiento</strong> (art. 11, I): para los datos de salud que decides
            informar.
          </li>
          <li>
            <strong>Interés legítimo</strong> (art. 7, IX): para seguridad y prevención de abusos.
          </li>
          <li>
            <strong>Cumplimiento de obligación legal</strong> (art. 7, II): por ejemplo, la
            conservación de registros de acceso exigida por el Marco Civil de Internet de Brasil.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Con quién compartimos">
        <p>
          Tus datos no se venden ni se comparten con anunciantes. Solo pasan por proveedores que nos
          ayudan a operar la app, bajo contrato y solo para ese fin:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos
            (como la foto de perfil).
          </li>
          <li>
            <strong>Vercel</strong> — alojamiento de la aplicación.
          </li>
          <li>
            <strong>Google</strong> — solo si eliges iniciar sesión con tu cuenta de Google, para
            confirmar tu identidad.
          </li>
        </ul>
        <p>
          También podemos compartir datos cuando lo exija la ley o una orden de autoridad
          competente. Cuando usas la opción de compartir tu perfil, la app genera una imagen en tu
          dispositivo solo con la información que marques; solo sale de la app si la envías tú. No
          existe una página pública de tu perfil.
        </p>
      </Secao>

      <Secao titulo="7. Transferencia internacional">
        <p>
          Los servidores de nuestros proveedores pueden estar fuera de Brasil, incluso en los
          Estados Unidos. En esas transferencias exigimos garantías de protección compatibles con la
          LGPD (art. 33).
        </p>
      </Secao>

      <Secao titulo="8. Por cuánto tiempo los guardamos">
        <p>
          Guardamos tus datos mientras tu cuenta exista. Cuando eliminas la cuenta, borramos tus
          datos y archivos. Pueden permanecer, por tiempo limitado, copias de seguridad que se
          sobrescriben automáticamente, y registros que la ley nos obliga a mantener — como los
          registros de acceso a aplicaciones, guardados por 6 meses (art. 15 del Marco Civil de
          Internet de Brasil).
        </p>
      </Secao>

      <Secao titulo="9. Tus derechos">
        <p>Según la LGPD (art. 18), puedes, en cualquier momento:</p>
        <ul>
          <li>confirmar si tratamos tus datos y acceder a ellos;</li>
          <li>corregir datos incompletos, inexactos o desactualizados;</li>
          <li>pedir la anonimización, el bloqueo o la eliminación de datos;</li>
          <li>pedir la portabilidad de tus datos;</li>
          <li>saber con quién compartimos tus datos;</li>
          <li>revocar el consentimiento dado para los datos de salud.</li>
        </ul>
        <p>
          Buena parte de esto lo haces tú en la app: edita tus datos en <strong>Perfil</strong> y,
          en <strong>Menú → Datos y cuenta</strong>, exporta una copia de todo o elimina tu cuenta
          definitivamente. Para los demás pedidos, escribe a{" "}
          <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a> — respondemos en hasta 15 días.
          También puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos de
          Brasil (ANPD).
        </p>
      </Secao>

      <Secao titulo="10. Seguridad">
        <p>
          Toda la comunicación con la app está cifrada (HTTPS), la contraseña se guarda cifrada y
          cada persona solo tiene acceso a sus propios datos — la regla se aplica en la propia base
          de datos, no solo en la pantalla. Ningún sistema es totalmente inmune a fallas; si ocurre
          un incidente de seguridad que pueda representar un riesgo para ti, te avisaremos a ti y a
          la ANPD, como prevé la ley.
        </p>
      </Secao>

      <Secao titulo="11. Niños y adolescentes">
        <p>
          Habitual Fit no está destinado a menores de 14 años. Los adolescentes de entre 14 y 17
          años solo deben usarlo con el consentimiento y el acompañamiento de sus padres o tutores.
        </p>
      </Secao>

      <Secao titulo="12. Cambios en esta política">
        <p>
          Podemos actualizar esta política cuando la app cambie — por ejemplo, al lanzar nuevas
          funciones. La fecha de arriba indica la versión vigente, y los cambios relevantes se
          avisarán en la app antes de entrar en vigor. Consulta también los{" "}
          <Link to="/termos">Términos de uso</Link>.
        </p>
      </Secao>
    </LegalPage>
  );
}
