/* =============================================================================
   Cafetería Origen — lógica del panel de administración
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var usuario = null;
  var productosCache = {};
  var csrfToken = null;

  function obtenerCsrf(contexto) {
    if (csrfToken) return Promise.resolve({ ok: true, data: { token: csrfToken } });
    return api('/csrf-token', { cache: 'no-store' }).then(function (resp) {
      if (!resp.ok || usuario !== contexto) return resp;
      if (typeof resp.data.token !== 'string' || !resp.data.token) {
        return { ok: false, status: resp.status, data: { error: 'No se pudo obtener el token de seguridad.' } };
      }
      csrfToken = resp.data.token;
      return resp;
    });
  }

  function headersConCsrf(token) {
    return {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    };
  }

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function money(valor) {
    return Number(valor || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function nodoTexto(etiqueta, valor, clase) {
    var nodo = document.createElement(etiqueta);
    nodo.textContent = valor == null ? '' : String(valor);
    if (clase) nodo.className = clase;
    return nodo;
  }

  function prepararTabla(tabla, titulos, columnasNumericas) {
    tabla.replaceChildren();
    var encabezado = tabla.createTHead().insertRow();
    titulos.forEach(function (titulo, indice) {
      var clase = columnasNumericas && columnasNumericas.includes(indice) ? 'num' : '';
      encabezado.append(nodoTexto('th', titulo, clase));
    });
    return tabla.createTBody();
  }

  function crearSelector(clase, valores, seleccionado) {
    var select = document.createElement('select');
    select.className = clase;
    valores.forEach(function (valor) {
      var opcion = nodoTexto('option', valor);
      opcion.value = valor;
      opcion.defaultSelected = valor === seleccionado;
      select.append(opcion);
    });
    return select;
  }

  function api(url, opciones) {
    return fetch(API + url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    }, function () {
      return { ok: false, status: 0, data: { error: 'No se pudo conectar con el servidor.' } };
    });
  }

  function consultarSesion() {
    return api('/auth/yo', { cache: 'no-store' });
  }

  function conSesion(peticion, recibir) {
    var contexto = usuario;
    if (!contexto) return Promise.resolve();

    return peticion(contexto).then(function (resp) {
      if (usuario !== contexto) return;
      if (resp.status === 401) {
        volverAlLogin('La sesión ya no está activa. Volvé a iniciar sesión.', false);
        return;
      }
      return recibir(resp);
    });
  }

  function leerPanel(url, recibir) {
    return conSesion(function () { return api(url); }, recibir);
  }

  function escribirPanel(metodo, url, cuerpo, recibir) {
    return conSesion(function (contexto) {
      return obtenerCsrf(contexto).then(function (resp) {
        if (!resp.ok || usuario !== contexto) return resp;
        var token = resp.data.token;
        if (metodo === 'DELETE') {
          var separador = url.indexOf('?') >= 0 ? '&' : '?';
          return api(url + separador + '_csrf=' + encodeURIComponent(token), {
            method: metodo,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
          });
        }
        return api(url, {
          method: metodo,
          credentials: 'same-origin',
          headers: headersConCsrf(token),
          body: JSON.stringify(Object.assign({}, cuerpo, { _csrf: token })),
        });
      });
    }, recibir);
  }

  function feedback(el, mensaje, ok) {
    el.className = 'form-feedback ' + (ok ? 'is-ok' : 'is-error');
    el.textContent = mensaje;
  }

  /* ------------------------------------------------------------------ login */
  function iniciarSesion(evento) {
    evento.preventDefault();
    var boton = evento.currentTarget.querySelector('button[type="submit"]');
    if (usuario || boton.disabled) return;

    var caja = $('#login-feedback');
    var campoPassword = $('#login-password');
    var credenciales = { username: $('#login-usuario').value, password: campoPassword.value };
    campoPassword.value = '';
    caja.className = 'form-feedback';
    caja.textContent = '';
    boton.disabled = true;

    api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciales),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No pudimos iniciar sesión: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      csrfToken = null;
      usuario = resp.data.usuario;
      mostrarPanel();
    }).finally(function () {
      boton.disabled = false;
    });
  }

  function cerrarSesion() {
    var boton = $('#btn-logout');
    if (!usuario || boton.disabled) return;

    var aviso = $('#logout-feedback');
    aviso.hidden = true;
    boton.disabled = true;

    function mostrarError(resp) {
      feedback(aviso, 'No pudimos cerrar sesión: ' + (resp.data.error || 'error desconocido'), false);
      aviso.hidden = false;
    }

    escribirPanel('POST', '/auth/logout', {}, function (resp) {
      if (resp.ok) {
        volverAlLogin('Sesión cerrada.', true);
        return;
      }
      if (resp.status === 403) {
        // CSRF puede rechazar el logout antes de que se compruebe la sesión.
        return conSesion(consultarSesion, function () { mostrarError(resp); });
      }
      mostrarError(resp);
    }).finally(function () {
      boton.disabled = false;
    });
  }

  function volverAlLogin(mensaje, ok) {
    usuario = null;
    csrfToken = null;
    productosCache = {};
    $('#vista-panel').hidden = true;
    $('#admin-user').replaceChildren();
    $('#panel-bienvenida').textContent = 'Panel';
    seleccionarTab(null);
    $$('#vista-panel table, #vista-panel .kpi-grid').forEach(function (el) { el.replaceChildren(); });
    $$('#vista-panel form').forEach(function (formulario) { formulario.reset(); });
    $$('#vista-panel .form-feedback, #vista-panel .output').forEach(function (el) { el.textContent = ''; });
    $('#login-password').value = '';
    $('#vista-login').hidden = false;
    feedback($('#login-feedback'), mensaje, ok);
    $('#login-usuario').focus();
  }

  function mostrarPanel() {
    var avisoLogout = nodoTexto('p', '', 'form-feedback');
    avisoLogout.id = 'logout-feedback';
    avisoLogout.setAttribute('role', 'status');
    avisoLogout.hidden = true;

    seleccionarTab('resumen');
    $('#vista-login').hidden = true;
    $('#vista-panel').hidden = false;
    $('#admin-user').replaceChildren(
      'Sesión de ', nodoTexto('strong', usuario.nombre),
      ' · rol: ', nodoTexto('strong', usuario.rol), avisoLogout
    );
    $('#panel-bienvenida').textContent = 'Hola, ' + usuario.nombre;
    cargarTodo();
  }

  function cargarTodo() {
    cargarResumen();
    cargarPedidos();
    cargarProductos();
    cargarReportes();
    cargarUsuarios();
  }

  /* ---------------------------------------------------------------- resumen */
  function mostrarKpis(contenedor, kpis) {
    contenedor.replaceChildren();
    kpis.forEach(function (kpi) {
      var tarjeta = document.createElement('div');
      tarjeta.className = 'kpi';
      tarjeta.append(
        nodoTexto('div', kpi.label, 'kpi-label'),
        nodoTexto('div', kpi.value, 'kpi-value')
      );
      contenedor.append(tarjeta);
    });
  }

  function cargarResumen() {
    leerPanel('/reportes/facturacion', function (f) {
      leerPanel('/reportes/mas-vendido', function (m) {
        leerPanel('/reportes/cantidad-vendida', function (c) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación total', value: money(f.data.facturado) },
            { label: 'Pedidos registrados', value: f.data.pedidos },
            {
              label: 'Producto más vendido',
              value: mas ? mas.nombre : '—',
            },
            {
              label: 'Unidades por tipo',
              value: Object.keys(c.data.cantidadVendida || {})
                .map(function (k) { return k + ': ' + c.data.cantidadVendida[k]; })
                .join(' · ') || '—',
            },
          ];

          mostrarKpis($('#kpis'), kpis);
        });
      });
    });
  }

  /* --------------------------------------------------------------- pedidos */
  function mostrarPedidos(tabla, filas, conAcciones) {
    var titulos = ['#', 'Mesa', 'Cliente', 'Estado', 'Total', 'Fecha'];
    if (conAcciones) titulos.push('Acciones');
    if (filas.length === 0) {
      tabla.replaceChildren();
      var celda = tabla.createTBody().insertRow().insertCell();
      celda.colSpan = titulos.length;
      celda.append(nodoTexto('p', 'No hay pedidos.', 'empty'));
      return;
    }

    var cuerpo = prepararTabla(tabla, titulos, [4]);
    var estados = ['abierto', 'preparando', 'listo', 'entregado'];
    filas.forEach(function (p) {
      var fila = cuerpo.insertRow();
      fila.append(nodoTexto('td', p.id), nodoTexto('td', p.mesa), nodoTexto('td', p.cliente));
      var estado = nodoTexto('span', p.estado, 'badge');
      if (estados.includes(p.estado)) estado.classList.add('badge-' + p.estado);
      fila.insertCell().append(estado);
      fila.append(
        nodoTexto('td', money(p.total), 'num'),
        nodoTexto('td', new Date(p.creado_en).toLocaleString('es-AR'))
      );
      if (conAcciones) {
        var select = crearSelector('sel-estado', estados, p.estado);
        select.dataset.pedido = p.id ?? '';
        fila.insertCell().append(select);
      }
    });
  }

  function cargarPedidos() {
    leerPanel('/pedidos', function (resp) {
      var pedidos = resp.data.pedidos || [];
      mostrarPedidos($('#tabla-pedidos'), pedidos, true);
      mostrarPedidos($('#tabla-ultimos'), pedidos.slice(0, 5), false);
    });
  }

  function cambiarEstado(evento) {
    var select = evento.target.closest('.sel-estado');
    if (!select) return;
    var id = select.getAttribute('data-pedido');
    escribirPanel('PATCH', '/pedidos/' + id + '/estado', { estado: select.value }, function (resp) {
      if (!resp.ok) {
        alert('No se pudo cambiar el estado: ' + (resp.data.error || 'error'));
      }
      cargarPedidos();
    });
  }

  /* ------------------------------------------------------------- productos */
  function cargarProductos() {
    leerPanel('/productos', function (resp) {
      var productos = resp.data.productos || [];
      productosCache = {};
      var cuerpo = prepararTabla($('#tabla-productos'), ['#', 'Nombre', 'Tipo', 'Origen', 'Precio', 'Acciones'], [4]);

      productos.forEach(function (p) {
        productosCache[p.id] = p;
        var fila = cuerpo.insertRow();
        fila.append(
          nodoTexto('td', p.id),
          nodoTexto('td', p.nombre),
          nodoTexto('td', p.tipo),
          nodoTexto('td', p.variedad || '—'),
          nodoTexto('td', money(p.precio), 'num')
        );
        var borrar = nodoTexto('button', 'Borrar', 'link-danger');
        borrar.dataset.borrar = p.id ?? '';
        fila.insertCell().append(borrar);
      });
    });
  }

  function guardarProducto(evento) {
    evento.preventDefault();
    var caja = $('#producto-feedback');
    var id = $('#producto-id').value;

    var cuerpo = {
      nombre: $('#p-nombre').value,
      tipo: $('#p-tipo').value,
      variedad: $('#p-variedad').value || null,
      tamano: $('#p-tamano').value || null,
      gramos: $('#p-gramos').value ? Number($('#p-gramos').value) : null,
      precio_base: Number($('#p-precio-base').value || 0),
      precio_por_gramo: Number($('#p-precio-gramo').value || 0),
      descripcion: $('#p-descripcion').value,
    };

    var url = id ? '/admin/productos/' + id : '/admin/productos';

    escribirPanel(id ? 'PUT' : 'POST', url, cuerpo, function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo guardar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Producto guardado correctamente.', true);
      $('#form-producto').reset();
      $('#producto-id').value = '';
      cargarProductos();
    });
  }

  function borrarProducto(evento) {
    var btn = evento.target.closest('[data-borrar]');
    if (!btn) return;
    var id = btn.getAttribute('data-borrar');
    if (!confirm('¿Borrar el producto #' + id + '?')) return;

    escribirPanel('DELETE', '/admin/productos/' + id, null, function (resp) {
      if (!resp.ok) alert('No se pudo borrar: ' + (resp.data.error || 'error'));
      cargarProductos();
    });
  }

  function limpiarFormularioProducto() {
    $('#form-producto').reset();
    $('#producto-id').value = '';
  }

  /* ---------------------------------------------------------------- upload */
  function subirArchivo(evento) {
    evento.preventDefault();
    var contexto = usuario;
    if (!contexto) return;

    var caja = $('#upload-feedback');
    var input = $('#archivo-subida');
    if (!input.files || !input.files[0]) {
      feedback(caja, 'Elegí un archivo primero.', false);
      return;
    }

    var archivo = input.files[0];
    var lector = new FileReader();

    lector.onload = function () {
      if (usuario !== contexto) return;
      var base64 = String(lector.result).split(',')[1] || '';
      escribirPanel('POST', '/admin/subir-archivo', {
        nombre: archivo.name,
        contenidoBase64: base64,
      }, function (resp) {
        if (!resp.ok) {
          feedback(caja, 'No se pudo subir: ' + (resp.data.error || 'error desconocido'), false);
          return;
        }
        feedback(caja, 'Archivo subido a ' + resp.data.url, true);
      });
    };

    lector.readAsDataURL(archivo);
  }

  /* -------------------------------------------------------------- reportes */
  function cargarReportes() {
    leerPanel('/reportes/facturacion', function (f) {
      leerPanel('/reportes/ticket-promedio', function (t) {
        leerPanel('/reportes/mas-vendido', function (m) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación', value: money(f.data.facturado) },
            { label: 'Pedidos', value: f.data.pedidos },
            { label: 'Ticket promedio', value: money(t.data.promedio) },
            { label: 'Más vendido', value: mas ? (mas.nombre ?? '') + ' (' + (mas.unidades ?? '') + ')' : '—' },
          ];
          mostrarKpis($('#kpis-reportes'), kpis);
        });
      });
    });
  }

  function consultarVentas() {
    var caja = $('#reporte-feedback');
    var tabla = $('#tabla-ventas');
    var variedad = $('#reporte-variedad').value;

    leerPanel('/reportes/ventas-por-variedad?variedad=' + encodeURIComponent(variedad), function (resp) {
      if (!resp.ok) {
        feedback(caja, 'Error: ' + (resp.data.error || 'desconocido'), false);
        tabla.replaceChildren();
        return;
      }
      var ventas = resp.data.ventas || [];
      var cuerpo = prepararTabla(tabla, ['Origen', 'Producto', 'Unidades', 'Total'], [2, 3]);
      ventas.forEach(function (v) {
        cuerpo.insertRow().append(
          nodoTexto('td', v.variedad),
          nodoTexto('td', v.nombre),
          nodoTexto('td', v.unidades, 'num'),
          nodoTexto('td', money(v.total), 'num')
        );
      });
      feedback(caja, 'Consulta realizada.', true);
    });
  }

  /* -------------------------------------------------------------- usuarios */
  function cargarUsuarios() {
    leerPanel('/admin/usuarios', function (resp) {
      var usuarios = resp.data.usuarios || [];
      var cuerpo = prepararTabla($('#tabla-usuarios'), ['#', 'Usuario', 'Nombre', 'Rol', 'Acciones']);
      var roles = ['cliente', 'mozo', 'barista', 'admin'];
      usuarios.forEach(function (u) {
        var fila = cuerpo.insertRow();
        fila.append(nodoTexto('td', u.id), nodoTexto('td', u.username), nodoTexto('td', u.nombre));
        fila.insertCell().append(nodoTexto('span', u.rol, u.rol === 'admin' ? 'badge badge-admin' : 'badge'));
        var select = crearSelector('sel-rol', roles, u.rol);
        select.dataset.usuario = u.id ?? '';
        fila.insertCell().append(select);
      });
    });
  }

  function cambiarRol(evento) {
    var select = evento.target.closest('.sel-rol');
    if (!select) return;
    var id = select.getAttribute('data-usuario');

    escribirPanel('PUT', '/admin/usuarios/' + id, { rol: select.value }, function (resp) {
      if (!resp.ok) alert('No se pudo actualizar: ' + (resp.data.error || 'error'));
      cargarUsuarios();
    });
  }

  function cambiarPassword(evento) {
    evento.preventDefault();
    var caja = $('#password-feedback');
    var campo = $('#nueva-password');
    var nueva = campo.value;
    campo.value = '';
    escribirPanel('POST', '/admin/cambiar-contrasena', { nueva: nueva }, function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo cambiar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      volverAlLogin('Contraseña actualizada. Volvé a iniciar sesión.', true);
    });
  }

  /* ----------------------------------------------------------- herramientas */
  function probarConexion(evento) {
    evento.preventDefault();
    var salida = $('#salida-conexion');
    salida.textContent = 'Probando…';

    escribirPanel('POST', '/admin/probar-conexion', { host: $('#conexion-host').value }, function (resp) {
      if (!resp.ok) {
        salida.textContent = 'Error: ' + (resp.data.error || 'desconocido');
        return;
      }
      salida.textContent =
        '$ ' + resp.data.comando + '\n\n' +
        (resp.data.salida || '') +
        (resp.data.error ? '\n[stderr]\n' + resp.data.error : '');
    });
  }

  function verDiagnostico() {
    var salida = $('#salida-diagnostico');
    salida.textContent = 'Cargando…';
    leerPanel('/_diagnostico', function (resp) {
      salida.textContent = JSON.stringify(resp.data, null, 2);
    });
  }

  /* ------------------------------------------------------------------ tabs */
  function seleccionarTab(vista) {
    $$('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-vista') === vista);
    });
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === vista);
    });
  }

  function activarTab(evento) {
    var tab = evento.target.closest('.tab');
    if (usuario && tab) seleccionarTab(tab.getAttribute('data-vista'));
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    var params = new URLSearchParams(window.location.search);
    var objetivo = params.get('vista');
    if (objetivo) {
      $('#panel-bienvenida').textContent = 'Panel ' + objetivo;
    }

    $('#form-login').addEventListener('submit', iniciarSesion);
    $('#btn-logout').addEventListener('click', cerrarSesion);
    $('#btn-refrescar').addEventListener('click', cargarTodo);
    $('#tabs').addEventListener('click', activarTab);
    $('#tabla-pedidos').addEventListener('change', cambiarEstado);
    $('#tabla-productos').addEventListener('click', borrarProducto);
    $('#form-producto').addEventListener('submit', guardarProducto);
    $('#btn-limpiar-producto').addEventListener('click', limpiarFormularioProducto);
    $('#form-upload').addEventListener('submit', subirArchivo);
    $('#form-password').addEventListener('submit', cambiarPassword);
    $('#btn-reporte-variedad').addEventListener('click', consultarVentas);
    $('#tabla-usuarios').addEventListener('change', cambiarRol);
    $('#form-conexion').addEventListener('submit', probarConexion);
    $('#btn-diagnostico').addEventListener('click', verDiagnostico);

    // ¿Ya hay sesión?
    consultarSesion().then(function (resp) {
      if (resp.ok && !usuario && !$('#form-login button[type="submit"]').disabled) {
        usuario = resp.data.usuario;
        mostrarPanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
