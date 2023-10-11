/*
<div class="alert alert-warning alert-dismissible fade show" role="alert">
  <strong>Holy guacamole!</strong> You should check in on some of those fields below.
  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
*/
alert_id_counter=0;
function add_alert(text, type="", alert_id="", closable=true, div_id="#alert_div",auto_dismiss=0) {
    let divhtml = '<div ';
    if (alert_id == "") {
      alert_id='alert'+alert_id_counter;
      alert_id_counter++;
    }
    if (alert_id != "") divhtml += 'id="'+alert_id+'" ';
    divhtml += 'class="alert'
    if (type != "") divhtml += ' alert-'+type;
    if (closable) divhtml += ' alert-dismissible';
    divhtml += ' fade show" role="alert">';
    divhtml += text;
    if (closable) divhtml += '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    divhtml += '</div>';
    $(div_id).append(divhtml);
    if (auto_dismiss != 0) {
      setTimeout( function() { $("#"+alert_id).alert('close'); }, auto_dismiss);
    }
}

function clear_alerts(div_id="#alert_div") {
   $(div_id).html("");
}

function remove_alert(alert_id) {
    $(alert_id).remove();
}
