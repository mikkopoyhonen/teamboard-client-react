'use strict';

var Immutable = require('immutable');

var Action      = require('../constants/actions');
var createStore = require('../utils/create-store');


/**
 * A list of tickets.
 *
 * TODO We need to store tickets based on the board they are on. Then we can do
 *      stuff like 'getTickets(boardID)'... The data structure will probably be
 *      Immutable.Map of BoardID to Immutable.List of Ticket.
 *
 *      This is actually something that is required to make the 'board-preview'
 *      have the ticket's as markers. So we can load all the tickets for all
 *      the boards the user has.
 *
 *      Map< BoardID, List<Ticket> >
 *
 * 		+ .getActiveTicket();
 *
 *      + .getTicket(boardID, ticketID);
 * 		+ .getTickets(boardID);
 *
 *      - .addTicket(boardID,    ticket);
 *      - .editTicket(boardID,   ticket);
 *      - .removeTicket(boardID, ticketID);
 *
 *      Boards = List[]Map{
*      		ID:         String,
*      	 	Name:       String,
*      	 	Background: String,
*
* 			Tickets: List[]Map{
* 				ID:      String,
* 				Color:   String,
* 				Content: String,
*
* 				Position: Map{
*     				X: Number,
*     				Y: Number,
*     				Z: Number,
* 				}
* 			}
*      }
*/

/**
 *
 */
var DataStoreAPI = {
	getBoard:  getBoard,
	getBoards: getBoards,

	getTicket:  getTicket,
	getTickets: getTickets,

	getActiveTicket: getActiveTicket,
}

/**
 *
 */
var _active = null;

/**
 *
 */
var _boards = Immutable.List([]);

/**
 *
 */
function getBoards() {
	var boards = _boards.map(function(b) {
		return b.remove('tickets');
	});
	return boards.toJS();
}

/**
 *
 */
function getBoard(boardID) {
	var board = _boards.find(function(b) {
		return b.id === boardID
	});
	return board ? board.remove('tickets').toJS() : null;
}

/**
 *
 */
function getTickets(boardID) {
	var board = _boards.find(function(b) {
		return b.id === boardID;
	});
	return board ? board.tickets.toJS() : null;
}

/**
 *
 */
function getTicket(boardID, ticketID) {
	var board = _boards.find(function(b) {
		return b.id === boardID;
	});
	if(board) {
		var ticket = board.tickets.find(function(t) {
			return t.id === ticketID;
		});
		return ticket ? ticket.toJS() : null;
	}
	return null;
}

/**
 *
 */
function getActiveTicket() {
	return _active;
}

/**
 * INTERNAL STUFF
 */

/**
 *
 */
function _addBoard(nBoard) {
	var index = _boards.findIndex(function(b) {
		return b.get('id') === nBoard.id;
	});
	if(index < 0) {
		return _boards.push(Immutable.Map({
			id:         nBoard.id,
			name:       nBoard.name,
			accessCode: nBoard.accessCode,
			background: nBoard.background,

			size:    Immutable.Map(nBoard.size),
			tickets: Immutable.List([]),
		}));
	}
	return _editBoard(nBoard.id, nBoard);
}

/**
 *
 */
function _removeBoard(boardID) {
	var index = _boards.findIndex(function(b) {
		return b.get('id') === boardID;
	});
	if(index < 0) {
		return _boards;
	}
	return _boards.remove(index);
}

/**
 *
 */
function _editBoard(boardID, uBoard) {
	var index = _boards.findIndex(function(b) {
		return b.get('id') === boardID;
	});
	if(index < 0) {
		return _boards;
	}
	return _boards.update(index, function(old) {
		return Immutable.Map({
			id:         uBoard.id         || old.get('id'),
			name:       uBoard.name       || old.get('name'),
			accessCode: uBoard.accessCode || old.get('accessCode'),
			background: uBoard.background || old.get('background'),

			// Size is an object with 'width' and 'height' attributes, so it
			// becomes a 'Map' similarly to 'ticket.position'.
			size: uBoard.size ? Immutable.Map(uBoard.size) : old.get('size'),

			// We preserve the tickets we already have, so updating a board
			// does not mess with the tickets already in store.
			tickets: old.get('tickets'),
		});
	});
}

/**
 * Adds the given Ticket(s) to the specified Board. If the given Ticket is an
 * array, the 'tickets' of the specified Board are replaced by it.
 */
function _addTicket(boardID, newTicket) {
	var index = _boards.findIndex(function(b) {
		return b.get('id') === boardID;
	});
	if(index < 0) {
		_boards = _boards.push(Immutable.Map({ id: boardID }));
	}
	return _boards.update(index, function(board) {
		if(newTicket instanceof Array) {
			var newTickets = newTicket.map(function(ticket) {
				return Immutable.Map({
					id:       ticket.id,
					color:    ticket.color,
					content:  ticket.content,
					position: Immutable.Map({
						x: ticket.position.x,
						y: ticket.position.y,
					}),
					updatedAt: ticket.updatedAt,
				}),
			});
			return board.set('tickets', Immutable.List(newTickets));
		}
		return board.set('tickets', board.tickets.push(Immutable.Map({
			id:       newTicket.id,
			color:    newTicket.color,
			content:  newTicket.content,
			position: Immutable.Map({
				x: newTicket.position.x,
				y: newTicket.position.y,
			}),
			updatedAt: newTicket.updatedAt,
		})));
	});
}

/**
 *
 */
function _removeTicket(boardID, ticketID) {
	var boardIndex = _boards.findIndex(function(b) {
		return b.get('id') === boardID;
	});
	if(boardIndex < 0) {
		return _boards;
	}
	return _boards.update(boardIndex, function(board) {
		var ticketIndex = board.tickets.findIndex(function(t) {
			return t.get('id') === ticketID;
		});
		if(ticketIndex < 0) {
			return board;
		}
		return board.set('tickets', board.tickets.remove(ticketIndex));
	});
}

/**
 *
 */
function _editTicket(boardID, ticketID, uTicket) {
	var boardIndex = _boards.findIndex(function(b) {
		return b.get('id') === boardID;
	});
	if(boardIndex < 0) {
		return _boards;
	}
	return _boards.update(boardIndex, function(oldBoard) {
		var ticketIndex = oldBoard.tickets.findIndex(function(t) {
			return t.get('id') === ticketID;
		});
		if(ticketIndex < 0) {
			return oldBoard;
		}
		return oldBoard.set('tickets',
			oldBoard.tickets.update(ticketIndex, function(oldTicket) {
				return Immutable.Map({
					id:      uTicket.id      || oldTicket.get('id'),
					color:   uTicket.color   || oldTicket.get('color'),
					content: uTicket.content || oldTicket.get('content'),

					position: uTicket.position ? Immutable.Map({
						x: uTicket.position.x,
						y: uTicket.position.y,
					}) : oldTicket.get('position'),

					updatedAt: uTicket.updatedAt,
				});
			}));
	});
}

/**
 * A store of tickets.
 */
module.exports = createStore(TicketStoreAPI, function(action) {
	switch(action.type) {
		/**
		 *
		 */
		case Action.LOAD_TICKETS_SUCCESS:
			_initialize(action.payload);
			_calculateZLayers();
			this.emitChange();
			break;

		/**
		 *
		 */
		case Action.ADD_TICKET:
			_addTicket(action.payload);
			this.emitChange();
			break;
		case Action.ADD_TICKET_SUCCESS:
			_update(_index(action.payload.dirty), action.payload.clean);
			_calculateZLayers();
			this.emitChange();
			break;
		case Action.ADD_TICKET_FAILURE:
			break;

		/**
		 *
		 */
		case Action.EDIT_TICKET:
			_update(_index(action.payload.id), action.payload);
			_calculateZLayers();
			this.emitChange();
			break;
		case Action.EDIT_TICKET_FAILURE:
			break;

		/**
		 *
		 */
		case Action.REMOVE_TICKET:
			_remove(_index(action.payload.id));
			this.emitChange();
			break;
		case Action.REMOVE_TICKET_FAILURE:
			break;

		/**
		 *
		 */
		case Action.SET_TICKET_ACTIVE:
			_active = action.payload.id;
			this.emitChange();
			break;
	}
});

// /**
//  * Get the ticket with the same 'id.server' as 'id'.
//  */
// function getTicket(id) {
// 	return _tickets.find(function(t) {
// 		return t.id === id;
// 	});
// }

// /**
//  * Get the tickets currently in store.
//  */
// function getTickets() {
// 	return _tickets.toArray();
// }

// /**
//  * Get the currently 'active' ticket.
//  */
// function getActiveTicket() {
// 	return _active;
// }

// /**
//  *
//  */
// function _initialize(tickets) {
// 	_tickets = Immutable.List(tickets);
// }

// /**
//  *
//  */
// function _addTicket(ticket) {
// 	_tickets = _tickets.push(ticket);
// }

// /**
//  *
//  */
// function _sortByDate() {
// 	_tickets = _tickets.sortBy(function(t) {
// 		return t.updatedAt;
// 	});
// }

// /**
//  * Get the index of the ticket specified by the given 'id'.
//  */
// function _index(id) {
// 	return _tickets.findIndex(function(t) {
// 		return t.id === id;
// 	});
// }

// /**
//  * Update the ticket at the given 'index'.
//  */
// function _update(index, ticket) {
// 	_tickets = _tickets.update(index, function(t) {
// 		t.id       = ticket.id       || t.id;
// 		t.color    = ticket.color    || t.color;
// 		t.content  = ticket.content  || t.content;
// 		t.position = ticket.position || t.position;

// 		t.updatedAt = Date.now();
// 		return t;
// 	});
// }

// /**
//  * Used to calculate the 'position.z' property for tickets, which only exists
//  * on the client. This is so that we don't constantly change the order of our
//  * tickets, because it can cause issues with rendering.
//  *
//  * TODO Can this be optimized?
//  */
// function _calculateZLayers() {
// 	// First we sort the tickets by their 'updatedAt' property, since it tells
// 	// us which order should the tickets have.
// 	var sorted = _tickets.sortBy(function(ticket) {
// 		return ticket.updatedAt;
// 	}).toArray();

// 	// Map IDs to their respective 'z-indices'.
// 	var zLayer = { }
// 	for(var i = 0; i < sorted.length; i++) {
// 		zLayer[sorted[i].id] = i;
// 	}

// 	// Finally we perform a simple map, which adds a 'z' attribute to the
// 	// position property of tickets.
// 	_tickets = _tickets.map(function(ticket) {
// 		ticket.position.z = zLayer[ticket.id];
// 		return ticket;
// 	});
// }

// /**
//  * Remove the ticket at the given index.
//  */
// function _remove(index) {
// 	_tickets = _tickets.remove(index);
// }
