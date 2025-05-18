/**
 * Catan: The Stack
 * Ditch Day 2025
 * @author Anna Kitagawa
 */

function qs(selector) {
    return document.querySelector(selector);
}

function qsa(selector) {
    return document.querySelectorAll(selector);
}

function gen(tagName) {
    return document.createElement(tagName);
}

function checkStatus(response) {
    if (!response.ok) {
        throw Error(`Error in request: ${response.statusText}`);
    }
    return response;
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}