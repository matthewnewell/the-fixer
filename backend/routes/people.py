"""The Depot's persona list for The Fixer's "viewing as" user menu, the same menu every app in the
ecosystem shows. Not a login: it's who a case, why-step, action, verification or journal note is
credited to."""

from flask import Blueprint, jsonify

import depot_client

bp = Blueprint("people", __name__, url_prefix="/api")


@bp.get("/people")
def list_people():
    people = depot_client.fetch_people()
    if people is None:
        return jsonify({"people": [], "depot_reachable": False})
    return jsonify({"people": people, "depot_reachable": True})
